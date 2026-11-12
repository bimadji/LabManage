/**
 * Mode demo: menampilkan data contoh (src/lib/mock-data.ts) tanpa menyentuh database.
 * Default mati. Nyalakan hanya untuk presentasi lokal: NEXT_PUBLIC_DEMO_MODE=true.
 * Saat aktif, semua aksi tulis ditolak dan UI menampilkan penanda "MODE DEMO".
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
