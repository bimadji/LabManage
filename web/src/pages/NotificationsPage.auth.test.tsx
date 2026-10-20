import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

const auth = vi.hoisted(() => ({
  session: null as Session | null,
  callbacks: new Set<(event: AuthChangeEvent, session: Session | null) => void>(),
}));

// Hook useSession/useProfile tetap asli; hanya batas jaringan Supabase yang diganti.
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      getUser: async () => ({ data: { user: auth.session?.user } }),
      onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        auth.callbacks.add(callback);
        return { data: { subscription: { unsubscribe: () => auth.callbacks.delete(callback) } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          single: async () => ({ data: { id, role: 'anggota', full_name: id } }),
        }),
      }),
    }),
  }),
}));

function session(id: string): Session {
  return {
    access_token: `token-${id}`,
    refresh_token: 'test-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-10-20T00:00:00Z',
    },
  };
}

beforeEach(() => {
  auth.session = session('member-a');
  auth.callbacks.clear();
  window.history.replaceState({}, '', '/notifikasi');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      const isA = new Headers(init?.headers).get('Authorization') === 'Bearer token-member-a';
      return new Response(
        JSON.stringify([
          {
            id: isA ? 'a' : 'b',
            kind: 'laporan',
            message: isA ? 'Pesan pribadi A' : 'Pesan pribadi B',
            readAt: null,
            createdAt: '2026-10-20T00:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it('perubahan sesi langsung A ke B menghapus daftar lama dan memuat notifikasi akun B', async () => {
  render(<App />);
  expect(await screen.findByText('Pesan pribadi A')).toBeInTheDocument();
  await act(async () => {
    auth.session = session('member-b');
    for (const callback of auth.callbacks) callback('SIGNED_IN', auth.session);
  });
  expect(screen.queryByText('Pesan pribadi A')).not.toBeInTheDocument();
  expect(await screen.findByText('Pesan pribadi B')).toBeInTheDocument();
});
