import type { StatusType } from "@/components/common/status-badge";

/**
 * Urutan tampilan Kotak Masuk: yang paling perlu perhatian dulu.
 *   1. menunggu  — perlu verifikasi Admin
 *   2. ditolak   — sudah ditutup, tapi perlu dilihat anggota
 *   3. disetujui — barang sedang dipinjam (tanggung jawab peminjam masih berjalan)
 *   4. ditangani — laporan sedang ditindaklanjuti
 *   5. selesai   — rampung
 * Sort stabil: urutan dalam status yang sama tetap mengikuti urutan dari server
 * (terbaru dulu), jadi `Array.prototype.sort` bawaan cukup.
 */
const PRIORITAS: Record<string, number> = {
  menunggu: 0,
  ditolak: 1,
  disetujui: 2,
  ditangani: 3,
  selesai: 4,
};

export function sortByStatusPriority<T extends { status: StatusType }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (PRIORITAS[a.status] ?? 99) - (PRIORITAS[b.status] ?? 99)
  );
}
