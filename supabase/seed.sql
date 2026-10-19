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

insert into public.equipment (name, category, total_qty, location) values
  ('Sensor Ultrasonik HC-SR04', 'sensor', 8, 'Lemari A'),
  ('Motor Servo MG996R', 'aktuator', 6, 'Lemari A'),
  ('Arduino Uno', 'mikrokontroler', 10, 'Lemari B'),
  ('Kabel Jumper', 'kabel', 40, 'Laci 2'),
  ('Baterai LiPo 3S', 'daya', 4, 'Lemari C')
on conflict (name) do nothing;
