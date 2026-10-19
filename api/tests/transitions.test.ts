import { describe, expect, it } from 'vitest';
import { canTransition } from '../src/reports/transitions.js';

describe('canTransition', () => {
  it('baru → ditindaklanjuti diizinkan', () => {
    expect(canTransition('baru', 'ditindaklanjuti')).toBe(true);
  });

  it('ditindaklanjuti → selesai diizinkan', () => {
    expect(canTransition('ditindaklanjuti', 'selesai')).toBe(true);
  });

  it('baru → selesai ditolak', () => {
    expect(canTransition('baru', 'selesai')).toBe(false);
  });

  it('tidak boleh mundur', () => {
    expect(canTransition('ditindaklanjuti', 'baru')).toBe(false);
    expect(canTransition('selesai', 'ditindaklanjuti')).toBe(false);
  });

  it('tidak boleh tetap di status yang sama', () => {
    expect(canTransition('baru', 'baru')).toBe(false);
    expect(canTransition('selesai', 'selesai')).toBe(false);
  });
});
