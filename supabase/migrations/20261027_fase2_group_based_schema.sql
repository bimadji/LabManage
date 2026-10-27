-- Migration: 20261027_fase2_group_based_schema.sql
-- Group-based schema (tim_riset vs ukm Roboholic) with strict RLS and anti-collision booking constraints.
--
-- CATATAN PENTING:
-- - Fungsi helper TIDAK boleh dibuat di schema `auth` (milik Supabase, tidak writable).
--   Semua fungsi helper dibuat di schema `labmanage` (schema milik aplikasi).
-- - Skrip ini idempoten: aman dijalankan berkali-kali.

-- ============================================================
-- 0. SCHEMA APLIKASI
-- ============================================================
CREATE SCHEMA IF NOT EXISTS labmanage;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
-- uuid-ossp tidak diperlukan: gen_random_uuid() sudah built-in di PG13+.
-- btree_gist WAJIB untuk operator && pada tstzrange (exclusion constraint).
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================
-- 2. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE kelompok_type AS ENUM ('tim_riset', 'ukm');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'anggota', 'advisor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_status AS ENUM ('tersedia', 'rusak', 'habis');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('menunggu', 'disetujui', 'ditolak', 'selesai');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('aktif', 'selesai', 'dibatalkan');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_urgency AS ENUM ('normal', 'tinggi', 'darurat');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('menunggu', 'ditangani', 'selesai');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. TABLES
-- ============================================================

-- Table: kelompok
CREATE TABLE IF NOT EXISTS kelompok (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  jenis kelompok_type NOT NULL,
  target_jam_mingguan INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_target_jam_by_jenis CHECK (
    (jenis = 'tim_riset' AND target_jam_mingguan IS NOT NULL AND target_jam_mingguan > 0)
    OR
    (jenis = 'ukm' AND target_jam_mingguan IS NULL)
  )
);

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  nim TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'anggota',
  kelompok_id UUID NOT NULL REFERENCES kelompok(id) ON DELETE RESTRICT,
  avatar_url TEXT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  kode TEXT NOT NULL UNIQUE,
  kategori TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  stok_total INTEGER NOT NULL DEFAULT 0 CHECK (stok_total >= 0),
  stok_tersedia INTEGER NOT NULL DEFAULT 0 CHECK (stok_tersedia >= 0 AND stok_tersedia <= stok_total),
  status inventory_status NOT NULL DEFAULT 'tersedia',
  spesifikasi TEXT NULL,
  pemilik_kelompok_id UUID NULL REFERENCES kelompok(id) ON DELETE SET NULL,
  dapat_dipinjam_kelompok_lain BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: loan_requests
CREATE TABLE IF NOT EXISTS loan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kelompok_id UUID NOT NULL REFERENCES kelompok(id) ON DELETE RESTRICT,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  keperluan TEXT NOT NULL,
  tanggal_pinjam TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rencana_kembali TIMESTAMPTZ NOT NULL,
  tanggal_kembali TIMESTAMPTZ NULL,
  status loan_status NOT NULL DEFAULT 'menunggu',
  catatan_admin TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: room_bookings
CREATE TABLE IF NOT EXISTS room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruangan_id TEXT NOT NULL,
  nama_ruangan TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kelompok_id UUID NOT NULL REFERENCES kelompok(id) ON DELETE RESTRICT,
  waktu_mulai TIMESTAMPTZ NOT NULL,
  waktu_selesai TIMESTAMPTZ NOT NULL,
  keperluan TEXT NOT NULL,
  jumlah_peserta INTEGER NOT NULL CHECK (jumlah_peserta > 0),
  status booking_status NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_booking_time CHECK (waktu_selesai > waktu_mulai),
  CONSTRAINT no_overlapping_room_bookings EXCLUDE USING gist (
    ruangan_id WITH =,
    tstzrange(waktu_mulai, waktu_selesai, '[)') WITH &&
  ) WHERE (status = 'aktif')
);

-- Table: attendance_sessions (khusus anggota tim_riset)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kelompok_id UUID NOT NULL REFERENCES kelompok(id) ON DELETE RESTRICT,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ NULL,
  durasi_menit INTEGER GENERATED ALWAYS AS (
    CASE WHEN check_out IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (check_out - check_in)) / 60)
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_checkout_after_checkin CHECK (check_out IS NULL OR check_out > check_in)
);

-- Table: reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NULL REFERENCES inventory_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kelompok_id UUID NOT NULL REFERENCES kelompok(id) ON DELETE RESTRICT,
  deskripsi TEXT NOT NULL,
  urgensi report_urgency NOT NULL DEFAULT 'normal',
  status report_status NOT NULL DEFAULT 'menunggu',
  tindakan TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_kelompok_id ON profiles(kelompok_id);
CREATE INDEX IF NOT EXISTS idx_inventory_pemilik ON inventory_items(pemilik_kelompok_id);
CREATE INDEX IF NOT EXISTS idx_inventory_kategori ON inventory_items(kategori);
CREATE INDEX IF NOT EXISTS idx_loan_user_id ON loan_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_kelompok_id ON loan_requests(kelompok_id);
CREATE INDEX IF NOT EXISTS idx_loan_status ON loan_requests(status);
-- Catatan: idx_room_bookings_range tidak perlu dibuat manual;
-- exclusion constraint no_overlapping_room_bookings sudah membuat index GiQ otomatis.
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance_sessions(check_in);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ============================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER, schema labmanage)
-- ============================================================
-- Fungsi ini berada di schema non-exposed `labmanage` agar tidak menjadi
-- public API endpoint. RLS tetap bekerja karena fungsi owner (postgres) punya BYPASSRLS.
CREATE OR REPLACE FUNCTION labmanage.current_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION labmanage.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION labmanage.current_kelompok_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT kelompok_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION labmanage.current_kelompok_jenis()
RETURNS public.kelompok_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT k.jenis FROM public.profiles p
  JOIN public.kelompok k ON k.id = p.kelompok_id
  WHERE p.id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 6. GRANTS (Data API exposure + helper access)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA labmanage TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON kelompok TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON loan_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON attendance_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reports TO authenticated;

GRANT EXECUTE ON FUNCTION labmanage.current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION labmanage.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION labmanage.current_kelompok_id() TO authenticated;
GRANT EXECUTE ON FUNCTION labmanage.current_kelompok_jenis() TO authenticated;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE kelompok ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- Policies: kelompok
-- ----------------------------------------------------
DROP POLICY IF EXISTS kelompok_read_all_authenticated ON kelompok;
CREATE POLICY kelompok_read_all_authenticated ON kelompok
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS kelompok_admin_write ON kelompok;
CREATE POLICY kelompok_admin_write ON kelompok
  FOR ALL TO authenticated
  USING (labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.current_role() = 'admin');

-- ----------------------------------------------------
-- Policies: profiles
-- ----------------------------------------------------
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (
    labmanage.current_role() IN ('admin', 'advisor')
    OR id = auth.uid()
    OR kelompok_id = labmanage.current_kelompok_id()
  );

-- Anggota hanya boleh mengubah avatar miliknya: role & kelompok_id dikunci.
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE TO authenticated
  USING (
    labmanage.current_role() = 'admin'
    OR id = auth.uid()
  )
  WITH CHECK (
    labmanage.current_role() = 'admin'
    OR (
      id = auth.uid()
      AND role = labmanage.current_role()
      AND kelompok_id = labmanage.current_kelompok_id()
    )
  );

-- ----------------------------------------------------
-- Policies: inventory_items
-- ----------------------------------------------------
DROP POLICY IF EXISTS inventory_select_policy ON inventory_items;
CREATE POLICY inventory_select_policy ON inventory_items
  FOR SELECT TO authenticated
  USING (
    labmanage.current_role() IN ('admin', 'advisor')
    OR pemilik_kelompok_id IS NULL
    OR pemilik_kelompok_id = labmanage.current_kelompok_id()
    OR dapat_dipinjam_kelompok_lain = TRUE
  );

DROP POLICY IF EXISTS inventory_admin_manage ON inventory_items;
CREATE POLICY inventory_admin_manage ON inventory_items
  FOR ALL TO authenticated
  USING (labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.current_role() = 'admin');

-- Anggota boleh menambah barang milik kelompoknya sendiri.
DROP POLICY IF EXISTS inventory_member_insert_own_group ON inventory_items;
CREATE POLICY inventory_member_insert_own_group ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS inventory_member_modify_own_group ON inventory_items;
CREATE POLICY inventory_member_modify_own_group ON inventory_items
  FOR UPDATE TO authenticated
  USING (
    labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  )
  WITH CHECK (
    labmanage.current_role() = 'anggota'
    AND pemilik_kelompok_id = labmanage.current_kelompok_id()
  );

-- ----------------------------------------------------
-- Policies: loan_requests
-- ----------------------------------------------------
DROP POLICY IF EXISTS loan_select_policy ON loan_requests;
CREATE POLICY loan_select_policy ON loan_requests
  FOR SELECT TO authenticated
  USING (
    labmanage.current_role() IN ('admin', 'advisor')
    OR user_id = auth.uid()
  );

-- Admin TIDAK boleh membuat permohonan. Anggota/advisor boleh, atas nama diri sendiri.
DROP POLICY IF EXISTS loan_insert_policy ON loan_requests;
CREATE POLICY loan_insert_policy ON loan_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.current_role() <> 'admin'
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

DROP POLICY IF EXISTS loan_update_admin ON loan_requests;
CREATE POLICY loan_update_admin ON loan_requests
  FOR UPDATE TO authenticated
  USING (labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.current_role() = 'admin');

-- Pemohon boleh membatalkan selama status masih 'menunggu'.
DROP POLICY IF EXISTS loan_update_owner_cancel ON loan_requests;
CREATE POLICY loan_update_owner_cancel ON loan_requests
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'menunggu'
    AND labmanage.current_role() <> 'admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('menunggu', 'ditolak')
  );

-- ----------------------------------------------------
-- Policies: room_bookings
-- ----------------------------------------------------
DROP POLICY IF EXISTS room_bookings_select_all ON room_bookings;
CREATE POLICY room_bookings_select_all ON room_bookings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS room_bookings_insert ON room_bookings;
CREATE POLICY room_bookings_insert ON room_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS room_bookings_modify ON room_bookings;
CREATE POLICY room_bookings_modify ON room_bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR labmanage.current_role() = 'admin')
  WITH CHECK (user_id = auth.uid() OR labmanage.current_role() = 'admin');

DROP POLICY IF EXISTS room_bookings_delete ON room_bookings;
CREATE POLICY room_bookings_delete ON room_bookings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR labmanage.current_role() = 'admin');

-- ----------------------------------------------------
-- Policies: attendance_sessions (KHUSUS tim_riset)
-- ----------------------------------------------------
DROP POLICY IF EXISTS attendance_select_policy ON attendance_sessions;
CREATE POLICY attendance_select_policy ON attendance_sessions
  FOR SELECT TO authenticated
  USING (
    labmanage.current_role() = 'admin'
    OR labmanage.current_role() = 'advisor'
    OR (
      labmanage.current_kelompok_jenis() = 'tim_riset'
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS attendance_insert_tim_riset ON attendance_sessions;
CREATE POLICY attendance_insert_tim_riset ON attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS attendance_update_tim_riset ON attendance_sessions;
CREATE POLICY attendance_update_tim_riset ON attendance_sessions
  FOR UPDATE TO authenticated
  USING (
    labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
  )
  WITH CHECK (
    labmanage.current_kelompok_jenis() = 'tim_riset'
    AND user_id = auth.uid()
  );

-- ----------------------------------------------------
-- Policies: reports
-- ----------------------------------------------------
DROP POLICY IF EXISTS reports_select_policy ON reports;
CREATE POLICY reports_select_policy ON reports
  FOR SELECT TO authenticated
  USING (
    labmanage.current_role() IN ('admin', 'advisor')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS reports_insert_policy ON reports;
CREATE POLICY reports_insert_policy ON reports
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND kelompok_id = labmanage.current_kelompok_id()
  );

DROP POLICY IF EXISTS reports_update_policy ON reports;
CREATE POLICY reports_update_policy ON reports
  FOR UPDATE TO authenticated
  USING (
    labmanage.current_role() = 'admin'
    OR (user_id = auth.uid() AND status = 'menunggu')
  )
  WITH CHECK (
    labmanage.current_role() = 'admin'
    OR (user_id = auth.uid() AND status IN ('menunggu', 'selesai'))
  );
