import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../auth/useSession', () => ({
  useSession: () => ({
    session: { access_token: 'token', user: { id: 'admin-1' } },
    loading: false,
  }),
}));
const profileState: ProfileState = {
  profile: { id: 'admin-1', role: 'admin', fullName: 'Admin Satu' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
}));
const period = {
  kind: 'week',
  start: '2026-10-18T17:00:00Z',
  end: '2026-10-25T17:00:00Z',
  days: ['2026-10-19', '2026-10-25'],
};
const aggregate = {
  memberCount: 2,
  totalHours: 12.5,
  sessionCount: 4,
  belowTargetCount: 1,
  averageWeeklyHours: 6.25,
  attendanceRate: 0.5,
  overNightSessionCount: 1,
  overNightSessionRatio: 0.25,
};
const stats = {
  period,
  weeklyTargetMinutes: 600,
  targetMinutes: 600,
  aggregate,
  members: [
    {
      userId: 'member-1',
      fullName: 'Bima',
      totalHours: 2.5,
      sessionCount: 2,
      status: 'KURANG',
      averageWeeklyHours: 2.5,
      attendanceRate: 1 / 3,
      daysPresent: 1,
      elapsedDays: 3,
      overNightSessionCount: 1,
      overNightSessionRatio: 0.5,
    },
  ],
  trend: [{ period, ...aggregate }],
};
const target = {
  weeklyTargetMinutes: 600,
  updatedAt: '2026-10-20T00:00:00Z',
  updatedBy: 'admin-1',
};
const open = {
  id: 'session-1',
  userId: 'member-1',
  fullName: 'Bima',
  checkedInAt: '2026-10-20T10:00:00Z',
  checkedOutAt: null,
  durationMinutes: 1140,
  overNightLimit: true,
};
const correction = {
  id: 'correction-1',
  attendanceId: 'session-old',
  userId: 'member-1',
  actorId: 'admin-1',
  oldCheckedOutAt: null,
  checkedOutAt: '2026-10-19T13:00:00Z',
  reason: 'Koreksi yang sudah tercatat',
  createdAt: '2026-10-20T00:00:00Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const failure = (code: string, message: string) => json({ error: { code, message } }, 409);
const normal = (path: string) => {
  if (path === '/inventory/pending-count') return json({ total: 0 });
  if (path === '/attendance/statistics') return json(stats);
  if (path === '/attendance/target') return json(target);
  if (path === '/attendance/present') return json([open]);
  if (path === '/attendance/corrections') return json([correction]);
  throw new Error(`Unexpected request: ${path}`);
};
function mockApi(
  handle?: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      return handle?.(url, init) ?? normal(url.pathname);
    }),
  );
}
function renderPage() {
  window.history.replaceState({}, '', '/monitor/admin');
  return render(<App />);
}
const mutations = () =>
  vi.mocked(fetch).mock.calls.filter(([, init]) => ['PUT', 'PATCH'].includes(init?.method ?? ''));
const requests = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([input]) => new URL(String(input)).pathname === path);
async function ready() {
  await screen.findByLabelText('Target mingguan (menit)');
  await screen.findByLabelText('Alasan koreksi Bima');
}
function fillCorrection(date = '2026-10-20T20:30', reason = '  Lupa check-out setelah riset  ') {
  fireEvent.change(screen.getByLabelText('Waktu check-out Bima (WIB)'), {
    target: { value: date },
  });
  fireEvent.change(screen.getByLabelText('Alasan koreksi Bima'), { target: { value: reason } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T05:00:00Z'));
  profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Satu' };
  profileState.loading = false;
  mockApi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Absensi admin', () => {
  it('menampilkan agregat, statistik anggota, tren, target, sesi terbuka dan audit', async () => {
    renderPage();
    await ready();
    const total = within(screen.getByRole('region', { name: 'Ringkasan statistik' }));
    expect(total.getByText('12,5 jam')).toBeInTheDocument();
    expect(total.getByText('6,25 jam')).toBeInTheDocument();
    expect(total.getByText('25% (1 dari 4 sesi)')).toBeInTheDocument();
    expect(total.getByText('Anggota KURANG')).toBeInTheDocument();
    const member = within(screen.getByRole('article', { name: 'Statistik Bima' }));
    expect(member.getByText('KURANG')).toBeInTheDocument();
    expect(member.getByText('33,33%')).toBeInTheDocument();
    expect(member.getByText('50% (1 dari 2 sesi)')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tren mingguan' })).toHaveTextContent('12,5 jam');
    expect(screen.getByLabelText('Target mingguan (menit)')).toHaveValue(600);
    expect(screen.getByText('Koreksi yang sudah tercatat')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Monitoring langsung' })).toHaveAttribute(
      'href',
      '/monitor',
    );
    expect(screen.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
  });

  it('filter default memakai tanggal WIB dan perubahan diterapkan saat submit', async () => {
    vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
    mockApi((url) =>
      url.pathname === '/attendance/statistics' && url.searchParams.get('period') === 'month'
        ? json({
            ...stats,
            period: { ...period, kind: 'month', days: ['2026-10-01', '2026-10-31'] },
            targetMinutes: (600 * 31) / 7,
          })
        : undefined,
    );
    renderPage();
    await ready();
    expect(screen.getByLabelText('Tanggal dalam periode (WIB)')).toHaveValue('2026-10-21');
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    fireEvent.change(screen.getByLabelText('Jumlah minggu tren'), { target: { value: '4' } });
    expect(requests('/attendance/statistics')).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan statistik' }));
    await screen.findByText(/31 Oktober 2026/);
    const url = new URL(String(requests('/attendance/statistics').at(-1)![0]));
    expect(url.searchParams.get('period')).toBe('month');
    expect(url.searchParams.get('weeks')).toBe('4');
    expect(url.searchParams.get('date')).toBe('2026-10-21');
    expect(screen.getByText(/44,29 jam/)).toBeInTheDocument();
  });

  it.each([
    ['4.0', '4'],
    ['1e1', '10'],
  ])('menormalisasi jumlah minggu bulat %s menjadi %s', async (input, expected) => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('Jumlah minggu tren'), { target: { value: input } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan statistik' }));
    await waitFor(() => expect(requests('/attendance/statistics')).toHaveLength(2));
    expect(
      new URL(String(requests('/attendance/statistics')[1][0])).searchParams.get('weeks'),
    ).toBe(expected);
  });

  it.each(['anggota', 'advisor'] as const)(
    '%s tidak mendapat data atau formulir admin',
    async (role) => {
      profileState.profile!.role = role;
      renderPage();
      expect(await screen.findByText(/Halaman ini khusus admin/)).toBeInTheDocument();
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    },
  );

  it('menunggu profil dan tidak memuat data ketika profil gagal', () => {
    profileState.profile = null;
    profileState.loading = true;
    const view = renderPage();
    expect(screen.getByText('Memuat profil…')).toBeInTheDocument();
    profileState.loading = false;
    view.rerender(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Profil gagal dimuat');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it.each([
    ['/attendance/statistics', 'statistik'],
    ['/attendance/target', 'target'],
    ['/attendance/present', 'sesi'],
    ['/attendance/corrections', 'riwayat'],
  ])('kegagalan baca %s dapat dicoba lagi', async (path, label) => {
    let fail = true;
    mockApi((url) =>
      url.pathname === path && fail ? Promise.reject(new Error('offline')) : undefined,
    );
    renderPage();
    const retry = await screen.findByRole('button', { name: `Coba lagi ${label}` });
    expect(screen.getByRole('alert')).toHaveTextContent('Koneksi gagal');
    fail = false;
    await userEvent.setup().click(retry);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: `Coba lagi ${label}` })).not.toBeInTheDocument(),
    );
    await ready();
  });

  it('menampilkan kondisi kosong untuk anggota, sesi, dan riwayat', async () => {
    mockApi((url) =>
      url.pathname === '/attendance/statistics'
        ? json({ ...stats, members: [], trend: [] })
        : ['/attendance/present', '/attendance/corrections'].includes(url.pathname)
          ? json([])
          : undefined,
    );
    renderPage();
    expect(await screen.findByText('Belum ada anggota untuk ditampilkan.')).toBeInTheDocument();
    expect(await screen.findByText('Tidak ada sesi terbuka untuk dikoreksi.')).toBeInTheDocument();
    expect(await screen.findByText('Belum ada riwayat koreksi.')).toBeInTheDocument();
  });

  it('mengabaikan respons statistik dari filter sebelumnya', async () => {
    let finish!: (value: Response) => void;
    mockApi((url) =>
      url.pathname !== '/attendance/statistics'
        ? undefined
        : url.searchParams.get('period') === 'week'
          ? new Promise((resolve) => {
              finish = resolve;
            })
          : json({ ...stats, members: [{ ...stats.members[0], fullName: 'Data bulan' }] }),
    );
    renderPage();
    await ready();
    expect(screen.getByText('Memuat statistik…')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan statistik' }));
    await screen.findByRole('article', { name: 'Statistik Data bulan' });
    await act(async () => finish(json(stats)));
    expect(screen.queryByRole('article', { name: 'Statistik Bima' })).not.toBeInTheDocument();
  });

  it('menyimpan target sekali, menampilkan hasil sebenarnya dan menyegarkan statistik', async () => {
    let finish!: (value: Response) => void;
    mockApi((_url, init) =>
      init?.method === 'PUT'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : undefined,
    );
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('Target mingguan (menit)'), {
      target: { value: '1200' },
    });
    await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Simpan target' }));
    await waitFor(() => expect(mutations()).toHaveLength(1));
    expect(JSON.parse(String(mutations()[0][1]?.body))).toEqual({ weeklyTargetMinutes: 1200 });
    expect(screen.getByRole('button', { name: 'Simpan koreksi Bima' })).toBeDisabled();
    await act(async () => finish(json({ ...target, weeklyTargetMinutes: 1200 })));
    expect(await screen.findByText('Target mingguan disimpan.')).toBeInTheDocument();
    expect(screen.getByLabelText('Target mingguan (menit)')).toHaveValue(1200);
    await waitFor(() => expect(requests('/attendance/statistics')).toHaveLength(2));
  });

  it.each(['-1', '10081', '0.5', ''])(
    'menolak target tidak valid %s tanpa mutasi',
    async (value) => {
      renderPage();
      await ready();
      const input = screen.getByLabelText('Target mingguan (menit)');
      fireEvent.change(input, { target: { value } });
      fireEvent.submit(input.closest('form')!);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Target harus bilangan bulat 0–10080 menit',
      );
      expect(mutations()).toHaveLength(0);
    },
  );

  it('target nol valid dan kegagalan simpan tidak menghapus draf', async () => {
    let fail = true;
    mockApi((_url, init) =>
      init?.method === 'PUT'
        ? fail
          ? failure('FORBIDDEN', 'Tidak boleh menyimpan target')
          : json({ ...target, weeklyTargetMinutes: 0 })
        : undefined,
    );
    renderPage();
    await ready();
    fireEvent.change(screen.getByLabelText('Target mingguan (menit)'), { target: { value: '0' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simpan target' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak boleh menyimpan target');
    expect(screen.getByLabelText('Target mingguan (menit)')).toHaveValue(0);
    expect(screen.queryByText('Target mingguan disimpan.')).not.toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simpan target' }));
    await screen.findByText('Target mingguan disimpan.');
  });

  it('koreksi memakai WIB, alasan dipangkas, sekali saat klik ganda, dan audit dimuat ulang', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    let finish!: (value: Response) => void;
    let corrected = false;
    mockApi((url, init) =>
      init?.method === 'PATCH'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : corrected && url.pathname === '/attendance/present'
          ? json([])
          : corrected && url.pathname === '/attendance/corrections'
            ? json([{ ...correction, reason: 'Lupa check-out setelah riset' }])
            : undefined,
    );
    renderPage();
    await ready();
    fillCorrection();
    expect(screen.getByLabelText('Alasan koreksi Bima')).toHaveAttribute('maxlength', '1000');
    await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Simpan koreksi Bima' }));
    await waitFor(() => expect(mutations()).toHaveLength(1));
    expect(new URL(String(mutations()[0][0])).pathname).toBe(
      '/attendance/session-1/correct-check-out',
    );
    expect(JSON.parse(String(mutations()[0][1]?.body))).toEqual({
      checkedOutAt: '2026-10-20T13:30:00.000Z',
      reason: 'Lupa check-out setelah riset',
    });
    corrected = true;
    await act(async () => finish(json(correction)));
    expect(await screen.findByText('Koreksi check-out tersimpan.')).toBeInTheDocument();
    expect(await screen.findByText('Tidak ada sesi terbuka untuk dikoreksi.')).toBeInTheDocument();
    expect(await screen.findByText('Lupa check-out setelah riset')).toBeInTheDocument();
    expect(requests('/attendance/statistics')).toHaveLength(2);
  });

  it.each([
    ['2026-10-20T17:00', 'Alasan valid'],
    ['2026-10-21T12:01', 'Alasan valid'],
    ['', 'Alasan valid'],
    ['2026-10-20T20:30', ' abc '],
  ])('koreksi tidak valid ditahan: %s / %s', async (date, reason) => {
    renderPage();
    await ready();
    fillCorrection(date, reason);
    fireEvent.submit(screen.getByLabelText('Alasan koreksi Bima').closest('form')!);
    await screen.findByRole('alert');
    expect(mutations()).toHaveLength(0);
  });

  it('sesi yang sudah ditutup server tidak dilaporkan sukses dan draf dipertahankan', async () => {
    mockApi((_url, init) =>
      init?.method === 'PATCH'
        ? failure('SESSION_NOT_OPEN', 'Sesi kehadiran sudah ditutup')
        : undefined,
    );
    renderPage();
    await ready();
    fillCorrection();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simpan koreksi Bima' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi kehadiran sudah ditutup');
    expect(screen.getByLabelText('Alasan koreksi Bima')).toHaveValue(
      '  Lupa check-out setelah riset  ',
    );
    expect(screen.queryByText('Koreksi check-out tersimpan.')).not.toBeInTheDocument();
  });
});
