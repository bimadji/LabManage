-- Migration: 20261114000100_fase7_loan_group_visibility.sql
-- Keputusan pemilik (Paket 8B, 2026-11-14): anggota satu kelompok tim riset
-- boleh MELIHAT permohonan pinjaman rekan setimnya (baca-saja) supaya tidak
-- ada permintaan ganda untuk kebutuhan proyek yang sama. Verifikasi tetap
-- hanya Admin (tidak berubah).
--
-- Sebelumnya: anggota hanya bisa membaca permohonan miliknya sendiri
-- (user_id = auth.uid()).
--
-- Skrip idempoten: aman dijalankan berkali-kali.

DROP POLICY IF EXISTS loan_select_policy ON loan_requests;
CREATE POLICY loan_select_policy ON loan_requests
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (
      labmanage.current_role() IN ('admin', 'advisor')
      OR user_id = auth.uid()
      OR kelompok_id = labmanage.current_kelompok_id()
    )
  );

-- Policy tulis TIDAK diubah: anggota tetap hanya bisa membuat/membatalkan
-- permohonan miliknya sendiri (loan_insert_policy, loan_update_owner_cancel).
-- Verifikasi & penyelesaian tetap hanya Admin (loan_update_admin + RPC).
