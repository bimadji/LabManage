import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../auth/useSession', () => ({
  useSession: () => ({
    session: { access_token: 'token', user: { id: 'member-1' } },
    loading: false,
  }),
}));
const profileState: ProfileState = {
  profile: { id: 'member-1', role: 'anggota', fullName: 'Anggota' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
}));
const summary = {
  period: {
    kind: 'week',
    start: '2026-10-18T17:00:00Z',
    end: '2026-10-25T17:00:00Z',
    days: ['2026-10-19', '2026-10-20'],
  },
  weeklyTargetMinutes: 600,
  targetMinutes: 600,
  members: [
    {
      userId: 'member-1',
      fullName: 'Anggota',
      totalHours: 2.5,
      totalMinutes: 150,
      sessionCount: 2,
      targetMinutes: 600,
      status: 'KURANG',
      daysPresent: 2,
      elapsedDays: 2,
      attendanceRate: 1,
      days: [
        { date: '2026-10-19', minutes: 60, sessionCount: 1 },
        { date: '2026-10-20', minutes: 90, sessionCount: 1 },
      ],
    },
  ],
};
const warning = {
  id: 'warning-1',
  userId: 'member-1',
  advisorId: 'advisor-1',
  weekStart: '2026-10-19',
  warningDate: '2026-10-20',
  message: 'Jadwalkan riset bersama tim.',
  note: 'Bersama tim',
  totalMinutes: 150,
  targetMinutes: 600,
  notificationId: 'notice-1',
  createdAt: '2026-10-20T16:00:00Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function mockApi(handle?: (url: URL) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === '/inventory/pending-count') return json({ total: 0 });
      if (handle) return handle(url);
      return json(url.pathname === '/attendance/summary' ? summary : [warning]);
    }),
  );
}
function renderPage() {
  window.history.replaceState({}, '', '/kehadiran/rekap');
  return render(<App />);
}
beforeEach(() => {
  profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota' };
  profileState.loading = false;
  mockApi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Rekap dan peringatan pribadi', () => {
  it('tanggal awal memakai WIB meskipun hari UTC masih sebelumnya', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
    renderPage();
    await screen.findByText('KURANG');
    expect(screen.getByLabelText('Tanggal dalam periode (WIB)')).toHaveValue('2026-10-21');
    const query = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => new URL(String(url)))
      .find((url) => url.pathname.endsWith('summary'))!;
    expect(query.searchParams.get('date')).toBe('2026-10-21');
  });

  it('menampilkan target bulanan prorata dan rentang kalender dari server', async () => {
    mockApi((url) =>
      json(
        url.pathname.endsWith('summary')
          ? {
              ...summary,
              period: { ...summary.period, kind: 'month', days: ['2026-09-01', '2026-09-30'] },
              targetMinutes: (600 * 30) / 7,
            }
          : [],
      ),
    );
    renderPage();
    expect(await screen.findByText('42,86 jam')).toBeInTheDocument();
    expect(screen.getByText(/1 September 2026.*30 September 2026/)).toBeInTheDocument();
    expect(screen.getByText(/target bulanan mengikuti/i)).toBeInTheDocument();
  });
  it('menampilkan ringkasan mingguan, status target, rincian harian dan peringatan WIB', async () => {
    renderPage();
    expect(await screen.findByText('KURANG')).toBeInTheDocument();
    expect(screen.getByText('2,5 jam')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Kehadiran per hari' }).children).toHaveLength(2);
    expect(await screen.findByText(warning.message)).toBeInTheDocument();
    expect(screen.getByText(/23[.:]00 WIB/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check-in / check-out' })).toHaveAttribute(
      'href',
      '/kehadiran',
    );
    expect(screen.getByRole('link', { name: 'Buka notifikasi' })).toHaveAttribute(
      'href',
      '/notifikasi',
    );
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      expect(new URL(String(url)).searchParams.get('userId')).toBe('member-1');
      expect(init?.method ?? 'GET').toBe('GET');
    }
  });
  it('pilihan bulan dan tanggal diterapkan saat Tampilkan ditekan', async () => {
    const paths: URL[] = [];
    mockApi((url) => {
      paths.push(url);
      return json(url.pathname.endsWith('summary') ? summary : []);
    });
    renderPage();
    await screen.findByText('KURANG');
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    fireEvent.change(screen.getByLabelText('Tanggal dalam periode (WIB)'), {
      target: { value: '2026-09-12' },
    });
    expect(paths.some((url) => url.searchParams.get('period') === 'month')).toBe(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan' }));
    await waitFor(() =>
      expect(
        paths.some(
          (url) =>
            url.searchParams.get('period') === 'month' &&
            url.searchParams.get('date') === '2026-09-12',
        ),
      ).toBe(true),
    );
  });
  it('menampilkan status TERCAPAI dari server, termasuk target nol', async () => {
    mockApi((url) =>
      json(
        url.pathname.endsWith('summary')
          ? {
              ...summary,
              targetMinutes: 0,
              members: [
                { ...summary.members[0], totalHours: 0, sessionCount: 0, status: 'TERCAPAI' },
              ],
            }
          : [],
      ),
    );
    renderPage();
    expect(await screen.findByText('TERCAPAI')).toBeInTheDocument();
    expect(screen.getByText(/belum ada sesi pada periode/i)).toBeInTheDocument();
    expect(await screen.findByText(/belum ada peringatan/i)).toBeInTheDocument();
  });
  it('error rekap tidak menyembunyikan peringatan dan dapat dicoba lagi', async () => {
    mockApi((url) =>
      url.pathname.endsWith('summary')
        ? json({ error: { code: 'INTERNAL', message: 'Rekap gagal dimuat' } }, 500)
        : json([warning]),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Rekap gagal dimuat');
    expect(await screen.findByText(warning.message)).toBeInTheDocument();
    mockApi();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi rekap' }));
    expect(await screen.findByText('KURANG')).toBeInTheDocument();
  });
  it('error peringatan tidak menyembunyikan rekap dan dapat dicoba lagi', async () => {
    mockApi((url) =>
      url.pathname.endsWith('warnings') ? Promise.reject(new Error('offline')) : json(summary),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Koneksi gagal');
    expect(await screen.findByText('KURANG')).toBeInTheDocument();
    mockApi();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi peringatan' }));
    expect(await screen.findByText(warning.message)).toBeInTheDocument();
  });
  it('respons periode lama tidak menimpa hasil periode baru', async () => {
    let finish!: (response: Response) => void;
    mockApi((url) =>
      url.pathname.endsWith('warnings')
        ? json([])
        : new Promise<Response>((resolve) => {
            finish = resolve;
          }),
    );
    renderPage();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(screen.getByText('Memuat rekap…')).toBeInTheDocument();
    mockApi((url) =>
      json(
        url.pathname.endsWith('summary')
          ? { ...summary, members: [{ ...summary.members[0], totalHours: 5 }] }
          : [],
      ),
    );
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan' }));
    expect(await screen.findByText('5 jam')).toBeInTheDocument();
    await act(async () => finish(json(summary)));
    expect(screen.queryByText('2,5 jam')).not.toBeInTheDocument();
  });
  it('Muat ulang memperbarui rekap serta peringatan', async () => {
    renderPage();
    await screen.findByText(warning.message);
    mockApi((url) =>
      json(
        url.pathname.endsWith('summary')
          ? { ...summary, members: [{ ...summary.members[0], totalHours: 5 }] }
          : [],
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    expect(await screen.findByText('5 jam')).toBeInTheDocument();
    expect(await screen.findByText(/belum ada peringatan/i)).toBeInTheDocument();
  });
  it.each(['admin', 'advisor'] as const)(
    '%s tidak memuat data halaman rekap anggota',
    async (role) => {
      profileState.profile = { id: role, role, fullName: role };
      renderPage();
      expect(screen.getByText(/halaman ini khusus anggota/i)).toBeInTheDocument();
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/attendance/')),
      ).toBe(false);
    },
  );
  it('profil belum tersedia tidak memicu permintaan data pribadi', async () => {
    profileState.loading = true;
    profileState.profile = null;
    const view = renderPage();
    expect(screen.getByText('Memuat profil…')).toBeInTheDocument();
    profileState.loading = false;
    view.rerender(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Profil');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('pergantian anggota membuang respons akun sebelumnya', async () => {
    const finishes: ((response: Response) => void)[] = [];
    mockApi(() => new Promise<Response>((resolve) => finishes.push(resolve)));
    const view = renderPage();
    await waitFor(() => expect(finishes).toHaveLength(2));
    profileState.profile = { id: 'member-2', role: 'anggota', fullName: 'Lain' };
    mockApi((url) => json(url.pathname.endsWith('summary') ? { ...summary, members: [] } : []));
    view.rerender(<App />);
    await screen.findByText(/belum ada peringatan/i);
    await act(async () => {
      finishes[0](json(summary));
      finishes[1](json([warning]));
    });
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    expect(screen.queryByText('2,5 jam')).not.toBeInTheDocument();
  });
});
