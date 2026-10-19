import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    // Semua test berbagi satu database Supabase lokal. File yang berjalan paralel
    // bisa saling mengubah baris global (mis. hitungan permintaan menunggu),
    // sehingga file dijalankan berurutan agar hasilnya deterministik.
    fileParallelism: false,
  },
});
