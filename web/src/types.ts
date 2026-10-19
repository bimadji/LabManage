export type Role = 'anggota' | 'admin' | 'advisor';

export interface Room {
  id: string;
  name: string;
  kind: 'ruang' | 'alat';
}

export interface Reservation {
  id: string;
  roomId: string;
  team: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  status: 'aktif' | 'dibatalkan';
  createdAt: string;
}
