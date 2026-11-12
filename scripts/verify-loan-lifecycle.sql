-- Verifikasi siklus pinjam terhadap DB uji (Postgres lokal).
-- Jalankan:
--   docker exec -i <db_container> psql -U postgres -d <db_uji> -v ON_ERROR_STOP=1 < scripts/verify-loan-lifecycle.sql
-- Skrip ini MEMBUAT data uji sendiri (id tetap) dan keluar non-zero bila ada skenario gagal.
-- Jangan jalankan pada database produksi.

CREATE TABLE IF NOT EXISTS _loan_verify (n serial, name text, ok boolean, detail text);
TRUNCATE _loan_verify;
GRANT INSERT ON _loan_verify TO authenticated;

CREATE OR REPLACE FUNCTION public._loan_rec(p_name text, p_ok boolean, p_detail text) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO _loan_verify(name, ok, detail) VALUES (p_name, p_ok, p_detail)
$$;

-- Bersihkan sisa percobaan sebelumnya (hanya baris uji berprefiks ini).
DELETE FROM loan_requests WHERE keperluan LIKE 'uji-siklus%';
DELETE FROM inventory_items WHERE kode LIKE 'SIKLUS-%';

INSERT INTO kelompok (id, nama, jenis, target_jam_mingguan)
VALUES ('99999999-0000-0000-0000-000000000001', 'Kelompok Uji Siklus', 'tim_riset', 10)
ON CONFLICT (nama) DO NOTHING;

-- Identitas uji (hanya untuk DB uji): admin + anggota.
INSERT INTO auth.users (id, email)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'uji.admin@labmanage.test'),
 ('aaaaaaaa-0000-0000-0000-000000000002', 'uji.anggota@labmanage.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, nama, nim, role, kelompok_id, email)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'Uji Admin', 'UJI-001', 'admin', '99999999-0000-0000-0000-000000000001', 'uji.admin@labmanage.test'),
 ('aaaaaaaa-0000-0000-0000-000000000002', 'Uji Anggota', 'UJI-002', 'anggota', '99999999-0000-0000-0000-000000000001', 'uji.anggota@labmanage.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_items (id, nama, kode, kategori, lokasi, stok_total, stok_tersedia, status, dapat_dipinjam_kelompok_lain)
VALUES
 ('bbbbbbbb-0000-0000-0000-0000000000f1', 'Uji Cukup', 'SIKLUS-1', 'sensor', 'Rak Uji', 5, 5, 'tersedia', true),
 ('bbbbbbbb-0000-0000-0000-0000000000f2', 'Uji Kurang', 'SIKLUS-2', 'sensor', 'Rak Uji', 1, 1, 'tersedia', true),
 ('bbbbbbbb-0000-0000-0000-0000000000f3', 'Uji Race', 'SIKLUS-3', 'sensor', 'Rak Uji', 1, 1, 'tersedia', true),
 ('bbbbbbbb-0000-0000-0000-0000000000f4', 'Uji Rusak', 'SIKLUS-4', 'sensor', 'Rak Uji', 1, 0, 'rusak', true)
ON CONFLICT (kode) DO NOTHING;

INSERT INTO loan_requests (id, item_id, user_id, kelompok_id, jumlah, keperluan, rencana_kembali, status)
SELECT v.id, v.item, v.usr, v.kel, v.jml, v.ket, '2026-12-01'::timestamptz, v.st::loan_status
FROM (VALUES
 ('cccccccc-0000-0000-0000-0000000000f1'::uuid, 'bbbbbbbb-0000-0000-0000-0000000000f1'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, '99999999-0000-0000-0000-000000000001'::uuid, 2, 'uji-siklus setuju', 'menunggu'),
 ('cccccccc-0000-0000-0000-0000000000f2'::uuid, 'bbbbbbbb-0000-0000-0000-0000000000f2'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, '99999999-0000-0000-0000-000000000001'::uuid, 3, 'uji-siklus kurang', 'menunggu'),
 ('cccccccc-0000-0000-0000-0000000000f3'::uuid, 'bbbbbbbb-0000-0000-0000-0000000000f1'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, '99999999-0000-0000-0000-000000000001'::uuid, 1, 'uji-siklus tolak', 'menunggu'),
 ('cccccccc-0000-0000-0000-0000000000f4'::uuid, 'bbbbbbbb-0000-0000-0000-0000000000f4'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid, '99999999-0000-0000-0000-000000000001'::uuid, 1, 'uji-siklus rusak', 'disetujui')
) AS v(id, item, usr, kel, jml, ket, st)
ON CONFLICT (id) DO NOTHING;

-- 1. Setuju dengan stok cukup.
DO $$
DECLARE r public.loan_requests; s integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  r := public.verifikasi_pinjam('cccccccc-0000-0000-0000-0000000000f1', true, 'ok');
  SELECT stok_tersedia INTO s FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f1';
  PERFORM public._loan_rec('1. setuju stok cukup', r.status='disetujui' AND s=3, format('status=%s stok=%s (harap disetujui/3)', r.status, s));
EXCEPTION WHEN OTHERS THEN PERFORM public._loan_rec('1. setuju stok cukup', false, SQLERRM);
END $$;

-- 2. Setuju dengan stok kurang harus ditolak.
DO $$
DECLARE s integer; st text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.verifikasi_pinjam('cccccccc-0000-0000-0000-0000000000f2', true, 'ok');
    PERFORM public._loan_rec('2. setuju stok kurang ditolak', false, 'TIDAK ada error padahal stok kurang');
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    SELECT stok_tersedia INTO s FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f2';
    SELECT status INTO st FROM loan_requests WHERE id='cccccccc-0000-0000-0000-0000000000f2';
    PERFORM public._loan_rec('2. setuju stok kurang ditolak', s=1 AND st='menunggu' AND SQLERRM LIKE '%tidak mencukupi%',
      format('err="%s" stok=%s status=%s', SQLERRM, s, st));
  END;
END $$;

-- 3. Tolak tidak mengubah stok.
DO $$
DECLARE r public.loan_requests; s integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  r := public.verifikasi_pinjam('cccccccc-0000-0000-0000-0000000000f3', false, 'alat dipakai');
  SELECT stok_tersedia INTO s FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f1';
  PERFORM public._loan_rec('3. tolak tidak mengubah stok', r.status='ditolak' AND s=3, format('status=%s stok=%s', r.status, s));
EXCEPTION WHEN OTHERS THEN PERFORM public._loan_rec('3. tolak tidak mengubah stok', false, SQLERRM);
END $$;

-- 4. Selesai memulihkan stok + tanggal_kembali.
DO $$
DECLARE r public.loan_requests; s integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  r := public.selesaikan_pinjam('cccccccc-0000-0000-0000-0000000000f1');
  SELECT stok_tersedia INTO s FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f1';
  PERFORM public._loan_rec('4. selesai memulihkan stok', r.status='selesai' AND s=5 AND r.tanggal_kembali IS NOT NULL,
    format('status=%s stok=%s tanggal=%s', r.status, s, r.tanggal_kembali));
EXCEPTION WHEN OTHERS THEN PERFORM public._loan_rec('4. selesai memulihkan stok', false, SQLERRM);
END $$;

-- 5. Selesai dua kali tidak memulihkan dua kali.
DO $$
DECLARE s integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.selesaikan_pinjam('cccccccc-0000-0000-0000-0000000000f1');
    PERFORM public._loan_rec('5. selesai dua kali ditolak', false, 'TIDAK ada error pada penyelesaian kedua');
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    SELECT stok_tersedia INTO s FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f1';
    PERFORM public._loan_rec('5. selesai dua kali ditolak', s=5 AND SQLERRM LIKE '%disetujui%',
      format('err="%s" stok=%s (harus tetap 5)', SQLERRM, s));
  END;
END $$;

-- 6. Non-admin ditolak (verifikasi dan penyelesaian).
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.verifikasi_pinjam('cccccccc-0000-0000-0000-0000000000f2', true, 'ok');
    PERFORM public._loan_rec('6. non-admin ditolak', false, 'anggota berhasil memverifikasi');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._loan_rec('6. non-admin ditolak', SQLERRM LIKE '%Akses ditolak%', format('err="%s"', SQLERRM));
  END;
  BEGIN
    PERFORM public.selesaikan_pinjam('cccccccc-0000-0000-0000-0000000000f1');
    PERFORM public._loan_rec('6b. non-admin tidak bisa selesaikan', false, 'anggota berhasil menyelesaikan');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._loan_rec('6b. non-admin tidak bisa selesaikan', SQLERRM LIKE '%Akses ditolak%', format('err="%s"', SQLERRM));
  END;
END $$;

-- 7. Status item rusak tidak berubah saat stok dipulihkan.
DO $$
DECLARE s integer; st inventory_status;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
  SET LOCAL ROLE authenticated;
  PERFORM public.selesaikan_pinjam('cccccccc-0000-0000-0000-0000000000f4');
  SELECT stok_tersedia, status INTO s, st FROM inventory_items WHERE id='bbbbbbbb-0000-0000-0000-0000000000f4';
  PERFORM public._loan_rec('7. status rusak tidak berubah', st='rusak' AND s=1, format('stok=%s status=%s', s, st));
EXCEPTION WHEN OTHERS THEN PERFORM public._loan_rec('7. status rusak tidak berubah', false, SQLERRM);
END $$;

-- 8. Konfigurasi fungsi: SECURITY DEFINER, search_path, GRANT.
DO $$
DECLARE a text; b text;
BEGIN
  SELECT string_agg(p.proname||':def='||p.prosecdef||',sp='||coalesce(array_to_string(p.proconfig,','),'-'),' | ')
    INTO a FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('verifikasi_pinjam','selesaikan_pinjam','tambah_stok_inventory');
  SELECT string_agg(p.proname||'='||has_function_privilege('authenticated',p.oid,'EXECUTE'),' | ')
    INTO b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('verifikasi_pinjam','selesaikan_pinjam','tambah_stok_inventory');
  PERFORM public._loan_rec('8. SECURITY DEFINER + search_path', a LIKE '%def=true%' AND a NOT LIKE '%sp=-%', a);
  PERFORM public._loan_rec('9. GRANT EXECUTE authenticated', b NOT LIKE '%false%', b);
END $$;

SELECT name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS hasil, detail FROM _loan_verify ORDER BY n;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _loan_verify WHERE NOT ok) THEN
    RAISE EXCEPTION 'ADA SKENARIO GAGAL';
  END IF;
END $$;
