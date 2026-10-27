-- Migration: 20261027_fase3_admin_inventory_management.sql
-- Fitur: Admin Tambah Barang & Tambah Stok Unit Atomik

-- 1. Hapus izin tulis anggota pada inventory_items (hanya admin yang boleh insert/update/delete)
DROP POLICY IF EXISTS inventory_member_insert_own_group ON inventory_items;
DROP POLICY IF EXISTS inventory_member_modify_own_group ON inventory_items;

-- 2. Pastikan policy admin penuh
DROP POLICY IF EXISTS inventory_admin_manage ON inventory_items;
CREATE POLICY inventory_admin_manage ON inventory_items
  FOR ALL TO authenticated
  USING (labmanage.current_role() = 'admin')
  WITH CHECK (labmanage.current_role() = 'admin');

-- 3. Fungsi Atomik Tambah Stok Unit di schema public (agar dapat dipanggil via supabase.rpc)
-- Menggunakan SECURITY DEFINER dengan search_path aman dan validasi role admin
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
  -- Validasi peran: hanya admin laboratorium yang berhak menambah stok
  IF labmanage.current_role() <> 'admin' THEN
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

-- Beri hak eksekusi kepada authenticated
GRANT EXECUTE ON FUNCTION public.tambah_stok_inventory(UUID, INTEGER) TO authenticated;
