/**
 * Harness minimal untuk skrip verifikasi DB.
 * Aturan: skrip harus keluar dengan kode non-zero bila ada pemeriksaan gagal,
 * supaya CI tidak pernah hijau palsu.
 */
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test.local' })

export interface Check {
  name: string
  ok: boolean
  detail: string
}

export const results: Check[] = []

export function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Keluar 0 hanya bila semua pemeriksaan lulus. */
export function finish() {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} lulus`)
  if (failed.length > 0) {
    console.error(`GAGAL: ${failed.length} pemeriksaan tidak lulus`)
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  process.exit(0)
}

/**
 * Kredensial DB uji. Skrip ini menulis data, jadi JANGAN arahkan ke produksi.
 * Keluar 2 (bukan 0) bila env tidak tersedia: "tidak dijalankan" bukan "lulus".
 */
export function requireEnv() {
  const url = process.env.SUPABASE_TEST_URL
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY
  if (!url || !anonKey || url.includes('placeholder')) {
    console.error(
      'SKIP: SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY tidak diset di .env.test.local.\n' +
        'Jalankan terhadap Supabase lokal: npx supabase start lalu salin nilainya ke .env.test.local.'
    )
    process.exit(2)
  }
  if (!isLocalUrl(url)) {
    console.error('TOLAK: skrip ini menulis data; arahkan hanya ke DB uji lokal, bukan *.supabase.co.')
    process.exit(2)
  }
  return { url, anonKey }
}

/** Hanya host lokal yang boleh dipakai skrip yang menulis data. */
export function isLocalUrl(url: string): boolean {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}
