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
          single: async () => ({
            data: { id, role: id.startsWith('advisor-') ? 'advisor' : 'anggota', full_name: id },
          }),
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
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const isA = new Headers(init?.headers).get('Authorization') === 'Bearer token-member-a';
      if (new URL(String(input)).pathname === '/attendance/summary') {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify([
          {
            id: isA ? 'a' : 'b',
            userId: isA ? 'member-a' : 'member-b',
            weekStart: '2026-10-19',
            totalMinutes: 0,
            targetMinutes: 600,
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
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['/notifikasi', '/kehadiran/rekap'])(
  'perubahan sesi langsung A ke B menghapus data lama pada %s',
  async (path) => {
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(await screen.findByText('Pesan pribadi A')).toBeInTheDocument();
    await act(async () => {
      auth.session = session('member-b');
      for (const callback of auth.callbacks) callback('SIGNED_IN', auth.session);
    });
    expect(screen.queryByText('Pesan pribadi A')).not.toBeInTheDocument();
    expect(await screen.findByText('Pesan pribadi B')).toBeInTheDocument();
  },
);

it('pergantian sesi advisor ke anggota menghapus rekap dan hak kirim', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T05:00:00Z'));
  auth.session = session('advisor-a');
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            period: {
              kind: 'week',
              start: '2026-10-18T17:00:00Z',
              end: '2026-10-25T17:00:00Z',
              days: ['2026-10-19', '2026-10-25'],
            },
            weeklyTargetMinutes: 600,
            targetMinutes: 600,
            members: [
              {
                userId: 'member-1',
                fullName: 'Data khusus advisor',
                totalHours: 0,
                sessionCount: 0,
                status: 'KURANG',
                daysPresent: 0,
                elapsedDays: 3,
                attendanceRate: 0,
                days: [],
              },
            ],
          }),
          { status: 200 },
        ),
    ),
  );
  window.history.replaceState({}, '', '/monitor/rekap');
  render(<App />);
  expect(await screen.findByText('Data khusus advisor')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Kirim peringatan untuk Data khusus advisor' }),
  ).toBeEnabled();
  await act(async () => {
    auth.session = session('member-b');
    for (const callback of auth.callbacks) callback('SIGNED_IN', auth.session);
  });
  expect(screen.queryByText('Data khusus advisor')).not.toBeInTheDocument();
  expect(await screen.findByText(/Halaman ini khusus advisor/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
});
