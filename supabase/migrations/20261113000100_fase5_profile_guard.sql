-- Migration: 20261113_fase5_profile_guard.sql
-- Penutupan celah: user yang ada di auth.users tapi belum punya baris profiles
-- tidak boleh membaca atau menulis data apa pun.
--
-- Alasan: helper labmanage.current_role() mengembalikan NULL bila profil tidak ada,
-- sehingga policy berbentuk `current_role() IN (...)` bernilai NULL (bukan false)
-- dan policy longgar seperti `USING (true)` tetap meloloskan baris.
--
-- Skrip idempoten: aman dijalankan berkali-kali.

-- ============================================================
-- 1. HELPER: apakah user saat ini punya baris profiles?
-- ============================================================
CREATE OR REPLACE FUNCTION labmanage.has_profile()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION labmanage.has_profile() TO authenticated;

-- ============================================================
-- 2. POLICY BACA: wajib punya profil
-- ============================================================
DROP POLICY IF EXISTS kelompok_read_all_authenticated ON kelompok;
CREATE POLICY kelompok_read_all_authenticated ON kelompok
  FOR SELECT TO authenticated
  USING (labmanage.has_profile());

DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (
      labmanage.current_role() IN ('admin', 'advisor')
      OR id = auth.uid()
      OR kelompok_id = labmanage.current_kelompok_id()
    )
  );

DROP POLICY IF EXISTS inventory_select_policy ON inventory_items;
CREATE POLICY inventory_select_policy ON inventory_items
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (
      labmanage.current_role() IN ('admin', 'advisor')
      OR pemilik_kelompok_id IS NULL
      OR pemilik_kelompok_id = labmanage.current_kelompok_id()
      OR dapat_dipinjam_kelompok_lain = TRUE
    )
  );

DROP POLICY IF EXISTS loan_select_policy ON loan_requests;
CREATE POLICY loan_select_policy ON loan_requests
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (labmanage.current_role() IN ('admin', 'advisor') OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS room_bookings_select_all ON room_bookings;
CREATE POLICY room_bookings_select_all ON room_bookings
  FOR SELECT TO authenticated
  USING (labmanage.has_profile());

DROP POLICY IF EXISTS attendance_select_policy ON attendance_sessions;
CREATE POLICY attendance_select_policy ON attendance_sessions
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (
      labmanage.current_role() = 'admin'
      OR labmanage.current_role() = 'advisor'
      OR (
        labmanage.current_kelompok_jenis() = 'tim_riset'
        AND user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS reports_select_policy ON reports;
CREATE POLICY reports_select_policy ON reports
  FOR SELECT TO authenticated
  USING (
    labmanage.has_profile()
    AND (labmanage.current_role() IN ('admin', 'advisor') OR user_id = auth.uid())
  );

-- ============================================================
-- 3. POLICY TULIS: wajib punya profil
-- ============================================================
DROP POLICY IF EXISTS loan_insert_policy ON loan_requests;
CREATE POLICY loan_insert_policy ON loan_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.has_profile()
    AND labmanage.current_role() <> 'admin'
    AND user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
    AND EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.id = item_id
        AND (
          i.pemilik_kelompok_id IS NULL
          OR i.pemilik_kelompok_id = labmanage.current_kelompok_id()
          OR i.dapat_dipinjam_kelompok_lain = TRUE
        )
    )
  );

DROP POLICY IF EXISTS room_bookings_insert ON room_bookings;
CREATE POLICY room_bookings_insert ON room_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.has_profile()
    AND user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS room_bookings_modify ON room_bookings;
CREATE POLICY room_bookings_modify ON room_bookings
  FOR UPDATE TO authenticated
  USING (
    labmanage.has_profile()
    AND (user_id = auth.uid() OR labmanage.current_role() = 'admin')
  )
  WITH CHECK (
    labmanage.has_profile()
    AND (user_id = auth.uid() OR labmanage.current_role() = 'admin')
  );

DROP POLICY IF EXISTS room_bookings_delete ON room_bookings;
CREATE POLICY room_bookings_delete ON room_bookings
  FOR DELETE TO authenticated
  USING (
    labmanage.has_profile()
    AND (user_id = auth.uid() OR labmanage.current_role() = 'admin')
  );

DROP POLICY IF EXISTS attendance_insert_tim_riset ON attendance_sessions;
CREATE POLICY attendance_insert_tim_riset ON attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS attendance_update_tim_riset ON attendance_sessions;
CREATE POLICY attendance_update_tim_riset ON attendance_sessions
  FOR UPDATE TO authenticated
  USING (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
  )
  WITH CHECK (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS reports_insert_policy ON reports;
CREATE POLICY reports_insert_policy ON reports
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.has_profile()
    AND user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

-- Status laporan hanya boleh diubah Admin (PRD §3: verifikasi = Admin; anggota & advisor tidak).
DROP POLICY IF EXISTS reports_update_policy ON reports;
CREATE POLICY reports_update_policy ON reports
  FOR UPDATE TO authenticated
  USING (labmanage.has_profile() AND labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.has_profile() AND labmanage.current_role() = 'admin');

-- ============================================================
-- 4. POLICY INVENTARIS (tulis): wajib punya profil
-- ============================================================
DROP POLICY IF EXISTS inventory_admin_manage ON inventory_items;
CREATE POLICY inventory_admin_manage ON inventory_items
  FOR ALL TO authenticated
  USING (labmanage.has_profile() AND labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.has_profile() AND labmanage.current_role() = 'admin');

DROP POLICY IF EXISTS inventory_member_insert_own_group ON inventory_items;
CREATE POLICY inventory_member_insert_own_group ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS inventory_member_modify_own_group ON inventory_items;
CREATE POLICY inventory_member_modify_own_group ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  )
  WITH CHECK (
    labmanage.has_profile()
    AND labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  );

-- ============================================================
-- 5. POLICY PROFILES (ubah) & KELOMPOK (tulis): wajib punya profil
-- ============================================================
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE TO authenticated
  USING (
    labmanage.has_profile()
    AND (labmanage.current_role() = 'admin' OR id = auth.uid())
  )
  WITH CHECK (
    labmanage.has_profile()
    AND (
      labmanage.current_role() = 'admin'
      OR (
        id = auth.uid()
        AND role = labmanage.current_role()
        AND kelompok_id = labmanage.current_kelompok_id()
      )
    )
  );

DROP POLICY IF EXISTS kelompok_admin_write ON kelompok;
CREATE POLICY kelompok_admin_write ON kelompok
  FOR ALL TO authenticated
  USING (labmanage.has_profile() AND labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.has_profile() AND labmanage.current_role() = 'admin');

-- ============================================================
-- 6. POLICY PEMINJAMAN (ubah): hanya Admin memverifikasi.
-- Pemohon tetap boleh membatalkan permohonannya sendiri saat masih 'menunggu'
-- (WITH CHECK membatasi tujuan status: hanya 'menunggu' atau 'ditolak').
-- ============================================================
DROP POLICY IF EXISTS loan_update_admin ON loan_requests;
CREATE POLICY loan_update_admin ON loan_requests
  FOR UPDATE TO authenticated
  USING (labmanage.has_profile() AND labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.has_profile() AND labmanage.current_role() = 'admin');

DROP POLICY IF EXISTS loan_update_owner_cancel ON loan_requests;
CREATE POLICY loan_update_owner_cancel ON loan_requests
  FOR UPDATE TO authenticated
  USING (
    labmanage.has_profile()
    AND user_id = auth.uid()
    AND status = 'menunggu'
    AND labmanage.current_role() <> 'admin'
  )
  WITH CHECK (
    labmanage.has_profile()
    AND user_id = auth.uid()
    AND status IN ('menunggu', 'ditolak')
  );
