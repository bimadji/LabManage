import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('loadConfig', () => {
  it('menolak SUPABASE_URL non-lokal saat NODE_ENV=test', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'test', SUPABASE_URL: 'https://abc.supabase.co' }),
    ).toThrow(/lokal/);
  });

  it('menerima 127.0.0.1 dan localhost saat NODE_ENV=test', () => {
    for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321']) {
      expect(loadConfig({ ...base, NODE_ENV: 'test', SUPABASE_URL: url }).supabaseUrl).toBe(url);
    }
  });

  it('memakai port 4000 jika PORT kosong', () => {
    expect(loadConfig({ ...base, SUPABASE_URL: 'https://abc.supabase.co' }).port).toBe(4000);
  });

  it('gagal jika variabel wajib hilang', () => {
    expect(() => loadConfig({ SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow(
      /SUPABASE_ANON_KEY/,
    );
  });
});
