-- Tahap 1.14: notifikasi inventaris memakai mekanisme Tahap 1.11.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('reservasi', 'lembur', 'laporan', 'inventaris'));
