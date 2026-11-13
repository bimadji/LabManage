-- Verifikasi konfigurasi keamanan helper labmanage terhadap DB uji nyata.
-- Jalankan:
--   docker exec -i <db_container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/verify-security-definer.sql
-- Skrip ini menulis ke tabel sementara _secdef_verify dan keluar non-zero bila ada skenario gagal.
-- Jangan jalankan pada database produksi.
--
-- Dua helper wajib SECURITY DEFINER + search_path terkunci:
--   labmanage.has_profile() -> dipakai DI DALAM policy profiles_select_policy.
--     Tanpa SECURITY DEFINER ia membaca public.profiles di bawah RLS yang memanggilnya
--     sendiri -> rekursi tak berujung ("stack depth limit exceeded").
--   labmanage.is_admin() -> dipakai di dalam RPC admin-only; tanpa SECURITY DEFINER
--     ia berjalan sebagai pemanggil dan ikut tersaring RLS profiles.
CREATE TABLE IF NOT EXISTS _secdef_verify (n serial, name text, ok boolean, detail text);
TRUNCATE _secdef_verify;
GRANT INSERT ON _secdef_verify TO authenticated;

CREATE OR REPLACE FUNCTION public._secdef_rec(p_name text, p_ok boolean, p_detail text) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO _secdef_verify(name, ok, detail) VALUES (p_name, p_ok, p_detail)
$$;

-- 1. Atribut katalog: SECURITY DEFINER + search_path terkunci.
--    Inilah pemeriksaan yang membuat skrip ini GAGAL bila salah satu helper
--    kehilangan SECURITY DEFINER atau search_path-nya dilepas.
DO $$
DECLARE a text;
BEGIN
  SELECT string_agg(p.proname||':def='||p.prosecdef||',sp='||coalesce(array_to_string(p.proconfig,','),'-'),' | ')
    INTO a FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'labmanage' AND p.proname IN ('has_profile','is_admin');
  PERFORM public._secdef_rec('1. helper SECURITY DEFINER + search_path',
    a LIKE '%has_profile:def=true%' AND a LIKE '%is_admin:def=true%'
      AND a NOT LIKE '%def=false%' AND a NOT LIKE '%sp=-%', a);
END $$;

-- 2. Rekursi RLS dibuktikan: helper yang diturunkan ke SECURITY INVOKER
--    menghasilkan error 'stack depth limit exceeded' saat dipanggil dari
--    policy yang memanggilnya.
--    Catatan: ALTER di dalam blok BEGIN...EXCEPTION ikut ter-rollback oleh
--    savepoint implisit saat error ditangkap (test 5 memverifikasi tidak bocor).
DO $$
DECLARE msg text; v_uid text;
BEGIN
  SELECT id::text INTO v_uid FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    PERFORM public._secdef_rec('2. tanpa SECURITY DEFINER -> rekursi RLS terdeteksi', false, 'tidak ada profil admin — jalankan seed-dummy dulu');
    RETURN;
  END IF;
  BEGIN
    EXECUTE 'ALTER FUNCTION labmanage.has_profile() SECURITY INVOKER';
    PERFORM set_config('request.jwt.claim.sub', v_uid, false);
    SET LOCAL ROLE authenticated;
    PERFORM labmanage.has_profile();
    msg := '(TIDAK ADA ERROR)';
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  PERFORM public._secdef_rec('2. tanpa SECURITY DEFINER -> rekursi RLS terdeteksi',
    msg LIKE '%stack depth limit exceeded%' OR msg LIKE '%infinite recursion%', 'err="' || msg || '"');
END $$;

-- 3. Dengan SECURITY DEFINER, helper bisa dipanggil tanpa rekursi.
DO $$
DECLARE msg text; r boolean; v_uid text;
BEGIN
  SELECT id::text INTO v_uid FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    PERFORM public._secdef_rec('3. dengan SECURITY DEFINER -> jalan normal', false, 'tidak ada profil admin — jalankan seed-dummy dulu');
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_uid, false);
  SET LOCAL ROLE authenticated;
  BEGIN
    r := labmanage.has_profile();
    msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  PERFORM public._secdef_rec('3. dengan SECURITY DEFINER -> jalan normal',
    msg IS NULL AND r = true, 'hasil=' || coalesce(r::text,'-') || ' err="' || coalesce(msg,'-') || '"');
END $$;

-- 4. Policy pada tabel profiles memanggil has_profile(): dengan SECURITY DEFINER
--    policy itu tetap dievaluasi tanpa rekursi (baris milik sendiri terlihat).
DO $$
DECLARE msg text; n integer; v_uid text;
BEGIN
  SELECT id::text INTO v_uid FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    PERFORM public._secdef_rec('4. policy profiles (memakai has_profile) tanpa rekursi', false, 'tidak ada profil admin — jalankan seed-dummy dulu');
    RETURN;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_uid, false);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO n FROM public.profiles;
    msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  PERFORM public._secdef_rec('4. policy profiles (memakai has_profile) tanpa rekursi',
    msg IS NULL AND n >= 1, 'baris=' || coalesce(n::text,'-') || ' err="' || coalesce(msg,'-') || '"');
END $$;

-- 5. Uji probe pada langkah 2 tidak boleh mengubah atribut fungsi selamanya.
DO $$
DECLARE a text;
BEGIN
  SELECT string_agg(p.proname||':def='||p.prosecdef, ' | ') INTO a
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'labmanage' AND p.proname IN ('has_profile','is_admin');
  PERFORM public._secdef_rec('5. atribut helper tidak bocor setelah probe',
    a LIKE '%has_profile:def=true%' AND a LIKE '%is_admin:def=true%', a);
END $$;

SELECT name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS hasil, detail FROM _secdef_verify ORDER BY n;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _secdef_verify WHERE NOT ok) THEN
    RAISE EXCEPTION 'ADA SKENARIO GAGAL';
  END IF;
END $$;
