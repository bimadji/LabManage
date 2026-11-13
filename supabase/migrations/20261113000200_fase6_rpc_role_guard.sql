-- Migration: 20261113_fase6_rpc_role_guard.sql
-- Perbaikan: RPC admin-only tidak boleh lolos bila peran pemanggil NULL.
--
-- Celah yang ditemukan: helper labmanage.current_role() mengembalikan NULL bila
-- user tidak punya baris profiles. Pemeriksaan `IF current_role() <> 'admin'`
-- bernilai NULL (bukan TRUE) saat tanpa profil, sehingga blok penolakan
-- dilewati dan RPC tetap berjalan untuk user tanpa profil.
--
-- Perbaikan: gunakan `IS DISTINCT FROM 'admin'` (NULL-safe) plus cek profil.
-- Skrip idempoten: aman dijalankan berkali-kali.

-- ============================================================
-- 1. Helper: peran admin yang benar-benar terverifikasi
-- ============================================================
CREATE OR REPLACE FUNCTION labmanage.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION labmanage.is_admin() TO authenticated;

-- ============================================================
-- 2. RPC: tambah stok (hanya Admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tambah_stok_inventory(
  p_item_id UUID,
  p_jumlah INTEGER
)
RETURNS public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.inventory_items;
BEGIN
  -- Validasi peran: hanya admin laboratorium yang berhak menambah stok.
  -- IS DISTINCT FROM menutup celah profil kosong (current_role() = NULL).
  IF NOT labmanage.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin laboratorium yang dapat menambah stok'
      USING ERRCODE = '42501';
  END IF;

  -- Validasi jumlah unit: harus bilangan bulat positif
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah penambahan unit harus berupa bilangan bulat lebih dari 0'
      USING ERRCODE = '22023';
  END IF;

  -- Kunci baris untuk pembaruan atomik (mencegah race condition)
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang dengan ID % tidak ditemukan', p_item_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Update stok dan sesuaikan status jika sebelumnya 'habis'
  -- Catatan aturan: status 'rusak' TIDAK boleh berubah otomatis
  UPDATE public.inventory_items
  SET
    stok_total = stok_total + p_jumlah,
    stok_tersedia = stok_tersedia + p_jumlah,
    status = CASE
      WHEN status = 'habis' THEN 'tersedia'::inventory_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tambah_stok_inventory(UUID, INTEGER) TO authenticated;

-- ============================================================
-- 3. RPC: verifikasi peminjaman (hanya Admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.verifikasi_pinjam(
  p_loan_id UUID,
  p_setuju BOOLEAN,
  p_alasan TEXT DEFAULT NULL
)
RETURNS public.loan_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_loan public.loan_requests;
  v_stok INTEGER;
BEGIN
  IF NOT labmanage.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin laboratorium yang dapat memverifikasi peminjaman'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_loan FROM public.loan_requests WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permohonan peminjaman tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF v_loan.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Permohonan sudah diproses sebelumnya' USING ERRCODE = 'P0001';
  END IF;

  IF p_setuju THEN
    -- Kunci baris barang agar dua persetujuan bersamaan tidak menjatuhkan stok di bawah nol.
    SELECT stok_tersedia INTO v_stok
    FROM public.inventory_items WHERE id = v_loan.item_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Barang pada permohonan ini tidak ditemukan' USING ERRCODE = 'P0002';
    END IF;
    IF v_stok < v_loan.jumlah THEN
      RAISE EXCEPTION 'Stok tersedia tidak mencukupi: tersisa % unit, diminta % unit',
        v_stok, v_loan.jumlah USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.inventory_items
    SET stok_tersedia = stok_tersedia - v_loan.jumlah,
        status = CASE
          WHEN status = 'tersedia' AND stok_tersedia - v_loan.jumlah = 0
            THEN 'habis'::inventory_status
          ELSE status
        END,
        updated_at = NOW()
    WHERE id = v_loan.item_id;

    UPDATE public.loan_requests
    SET status = 'disetujui', catatan_admin = p_alasan
    WHERE id = p_loan_id
    RETURNING * INTO v_loan;
  ELSE
    UPDATE public.loan_requests
    SET status = 'ditolak', catatan_admin = p_alasan
    WHERE id = p_loan_id
    RETURNING * INTO v_loan;
  END IF;

  RETURN v_loan;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verifikasi_pinjam(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 4. RPC: selesaikan peminjaman (hanya Admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.selesaikan_pinjam(p_loan_id UUID)
RETURNS public.loan_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_loan public.loan_requests;
BEGIN
  IF NOT labmanage.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin laboratorium yang dapat menutup peminjaman'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_loan FROM public.loan_requests WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permohonan peminjaman tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF v_loan.status <> 'disetujui' THEN
    RAISE EXCEPTION 'Hanya peminjaman berstatus disetujui yang dapat diselesaikan'
      USING ERRCODE = 'P0001';
  END IF;

  -- LEAST menjaga stok_tersedia tidak melebihi stok_total (CHECK constraint).
  UPDATE public.inventory_items
  SET stok_tersedia = LEAST(stok_total, stok_tersedia + v_loan.jumlah),
      status = CASE
        WHEN status = 'habis' THEN 'tersedia'::inventory_status
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_loan.item_id;

  UPDATE public.loan_requests
  SET status = 'selesai', tanggal_kembali = NOW()
  WHERE id = p_loan_id
  RETURNING * INTO v_loan;

  RETURN v_loan;
END;
$$;

GRANT EXECUTE ON FUNCTION public.selesaikan_pinjam(UUID) TO authenticated;
