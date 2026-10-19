-- Data seed non-user untuk Supabase lokal.
-- Dijalankan otomatis oleh `npx supabase db reset`.
-- Baris yang merujuk auth.users (reservasi, kehadiran, laporan) dibuat oleh
-- `npm run db:seed-users` di api/, karena user demo baru ada setelah reset.

insert into public.rooms (name, kind) values
  ('Ruang Robotik A', 'ruang'),
  ('Ruang Robotik B', 'ruang'),
  ('Ruang Rapat', 'ruang'),
  ('Printer 3D', 'alat'),
  ('Meja Solder', 'alat')
on conflict (name) do nothing;

-- Komponen habis pakai (stok + min_stock) dan barang satuan (satu baris = satu unit).
insert into public.equipment (name, category, kind, quantity, min_stock, location) values
  ('Resistor 220 Ohm', 'komponen pasif', 'komponen', 40, 20, 'Laci 1'),
  ('Kapasitor 100 uF', 'komponen pasif', 'komponen', 3, 5, 'Laci 1'),
  ('Baterai LiPo 3S', 'daya', 'komponen', 0, 2, 'Lemari C'),
  ('Sensor Ultrasonik HC-SR04', 'sensor', 'komponen', 8, 3, 'Lemari A'),
  ('Motor Servo MG996R', 'aktuator', 'komponen', 6, 2, 'Lemari A'),
  ('Arduino Uno', 'mikrokontroler', 'komponen', 10, 4, 'Lemari B'),
  ('Kabel Jumper', 'kabel', 'komponen', 40, 10, 'Laci 2'),
  ('Osiloskop Rigol DS1054Z', 'alat ukur', 'barang', 1, 0, 'Meja 1'),
  ('Solder Station Hakko FX-888D', 'alat solder', 'barang', 1, 0, 'Meja 2'),
  ('Laptop Lenovo ThinkPad E14', 'komputer', 'barang', 1, 0, 'Lemari D'),
  ('Multimeter Fluke 17B+', 'alat ukur', 'barang', 1, 0, 'Meja 1')
on conflict (name) do nothing;
