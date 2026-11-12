-- Migration: 20261112_fase4_loan_lifecycle.sql
-- Stabilisasi: siklus pinjam (verifikasi -> selesai) atomik + kolom laporan yang dipakai UI.
--
-- Catatan stok:
-- - Stok TIDAK dipotong saat permohonan dibuat (masih 'menunggu').
-- - Stok dipotong saat disetujui, dipulihkan saat dikembalikan ('selesai').
-- - Penolakan tidak menyentuh stok karena belum pernah dipotong.
-- Skrip idempoten: aman dijalankan berkali-kali.

-- ============================================================
-- 1. KOLOM LAPORAN YANG DIPAKAI FORM UI
-- ============================================================
-- Form laporan mengumpulkan judul, lokasi, dan jenis (habis/rusak); tabel lama
-- hanya punya deskripsi. Tanpa kolom ini laporan tidak bisa disimpan apa adanya.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS judul TEXT NOT NULL DEFAULT '';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS lokasi TEXT NOT NULL DEFAULT '';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS jenis TEXT NOT NULL DEFAULT 'rusak';

DO $$ BEGIN
  ALTER TABLE public.reports
    ADD CONSTRAINT reports_jenis_check CHECK (jenis IN ('habis', 'rusak'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. VERIFIKASI PEMINJAMAN (setujui / tolak)
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
  IF labmanage.current_role() <> 'admin' THEN
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

-- ============================================================
-- 3. SELESAIKAN PEMINJAMAN (barang dikembalikan)
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
  IF labmanage.current_role() <> 'admin' THEN
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

GRANT EXECUTE ON FUNCTION public.verifikasi_pinjam(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.selesaikan_pinjam(UUID) TO authenticated;
