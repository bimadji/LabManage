/**
 * Daftar ruang & arena lab. Satu sumber kebenaran untuk UI dan database.
 * `id` dipakai sebagai `room_bookings.ruangan_id`; `nama` sebagai `nama_ruangan`.
 */
export interface Ruangan {
  id: string;
  nama: string;
  kode: string;
  kapasitas: number;
  deskripsi: string;
  slotWaktu: { label: string; mulai: string; selesai: string }[];
}

export const RUANGAN: Ruangan[] = [
  {
    id: "arena-kontes",
    nama: "Arena Uji Coba KRAI / KRI",
    kode: "ARENA-01",
    kapasitas: 25,
    deskripsi: "Lapangan karpet standar kontes robot nasional untuk manuver & uji sensor.",
    slotWaktu: [
      { label: "08:00 - 12:00 WIB (Pagi)", mulai: "08:00", selesai: "12:00" },
      { label: "13:30 - 17:30 WIB (Siang)", mulai: "13:30", selesai: "17:30" },
      { label: "18:30 - 21:30 WIB (Malam)", mulai: "18:30", selesai: "21:30" },
    ],
  },
  {
    id: "bengkel-mekanik",
    nama: "Ruang Mekanik & Fabrikasi",
    kode: "FAB-02",
    kapasitas: 15,
    deskripsi: "Area mesin bubut, gerinda, CNC router, perakitan mekanik, dan perkakas potong.",
    slotWaktu: [
      { label: "08:00 - 12:00 WIB (Pagi)", mulai: "08:00", selesai: "12:00" },
      { label: "13:30 - 17:30 WIB (Siang)", mulai: "13:30", selesai: "17:30" },
      { label: "18:30 - 21:30 WIB (Malam)", mulai: "18:30", selesai: "21:30" },
    ],
  },
  {
    id: "lab-utama",
    nama: "Ruang Diskusi & Pemrograman",
    kode: "SOFT-03",
    kapasitas: 20,
    deskripsi: "Ruang ber-AC dengan layar proyektor, meja workstation, dan switch LAN gigabit.",
    slotWaktu: [
      { label: "08:00 - 12:00 WIB (Pagi)", mulai: "08:00", selesai: "12:00" },
      { label: "13:30 - 17:30 WIB (Siang)", mulai: "13:30", selesai: "17:30" },
      { label: "18:30 - 21:30 WIB (Malam)", mulai: "18:30", selesai: "21:30" },
    ],
  },
];

export const SLOT_WAKTU = RUANGAN[0].slotWaktu;

/**
 * Tanggal + jam (Asia/Jakarta) -> timestamp ISO UTC.
 * Tanggal "YYYY-MM-DD", jam "HH:MM" (waktu lokal Jakarta, UTC+7).
 * null bila tanggal/jam tidak valid.
 */
export function toWibIso(tanggal: string, jam: string): string | null {
  const date = new Date(`${tanggal}T${jam}:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Tanggal hari ini di zona Asia/Jakarta (YYYY-MM-DD). */
export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Tanggal + N hari dari hari ini (Asia/Jakarta). */
export function addDaysWib(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() + days * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/** Dua rentang waktu bertabrakan? */
export function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}
