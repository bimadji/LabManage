import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../auth/useSession', () => ({
  useSession: () => ({
    session: { access_token: 'token', user: { id: 'advisor-1' } },
    loading: false,
  }),
}));
const profileState: ProfileState = {
  profile: { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
}));

const member = {
  userId: 'member-1',
  fullName: 'Bima',
  totalHours: 2.5,
  sessionCount: 2,
  status: 'KURANG',
  daysPresent: 2,
  elapsedDays: 3,
  attendanceRate: 2 / 3,
  days: [{ date: '2026-10-21', minutes: 150, sessionCount: 2 }],
};
const summary = {
  period: {
    kind: 'week',
    start: '2026-10-18T17:00:00Z',
    end: '2026-10-25T17:00:00Z',
    days: ['2026-10-19', '2026-10-25'],
  },
  weeklyTargetMinutes: 600,
  targetMinutes: 600,
  members: [
    member,
    { ...member, userId: 'member-2', fullName: 'Rani', totalHours: 10, status: 'TERCAPAI' },
  ],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const errorResponse = (code: string, message: string, status = 409) =>
  json({ error: { code, message } }, status);
function mockApi(handle?: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/inventory/pending-count') return json({ total: 0 });
      return handle ? handle(url, init) : json(summary);
    }),
  );
}
function renderPage() {
  window.history.replaceState({}, '', '/monitor/rekap');
  return render(<App />);
}
const warningButton = () => screen.getByRole('button', { name: 'Kirim peringatan untuk Bima' });
const posts = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T05:00:00Z'));
  profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
  profileState.loading = false;
  mockApi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Rekap advisor', () => {
  it('menampilkan semua anggota, rincian harian, status server, dan target', async () => {
    renderPage();
    const bima = within(await screen.findByRole('article', { name: 'Rekap Bima' }));
    const rani = within(screen.getByRole('article', { name: 'Rekap Rani' }));
    expect(bima.getByText('KURANG')).toBeInTheDocument();
    expect(bima.getByText('66,67%')).toBeInTheDocument();
    expect(bima.getByText('2,5 jam', { selector: 'dd' })).toBeInTheDocument();
    expect(bima.getByText('Rincian harian')).toBeInTheDocument();
    expect(rani.getByText('TERCAPAI')).toBeInTheDocument();
    expect(rani.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Monitoring langsung' })).toHaveAttribute(
      'href',
      '/monitor',
    );
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get('userId')).toBeNull();
    expect(url.searchParams.get('period')).toBe('week');
  });

  it('tanggal default menggunakan WIB pada pergantian hari UTC', async () => {
    vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
    renderPage();
    await screen.findByText('Bima');
    expect(screen.getByLabelText('Tanggal dalam periode (WIB)')).toHaveValue('2026-10-21');
  });

  it('filter bulan hanya diterapkan saat submit dan tidak menawarkan kirim peringatan', async () => {
    mockApi((url) =>
      json(
        url.searchParams.get('period') === 'month'
          ? {
              ...summary,
              period: {
                ...summary.period,
                kind: 'month',
                start: '2026-09-30T17:00:00Z',
                end: '2026-10-31T17:00:00Z',
                days: ['2026-10-01', '2026-10-31'],
              },
              targetMinutes: (600 * 31) / 7,
            }
          : summary,
      ),
    );
    renderPage();
    await screen.findByText('Bima');
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan' }));
    await screen.findByText(/1 Oktober 2026.*31 Oktober 2026/);
    expect(screen.getAllByText('44,29 jam').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Peringatan hanya untuk minggu berjalan/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Minggu ini' }));
    expect(
      await screen.findByRole('button', { name: 'Kirim peringatan untuk Bima' }),
    ).toBeEnabled();
    expect(screen.getByLabelText('Periode')).toHaveValue('week');
  });

  it('rekap minggu historis tetap baca saja', async () => {
    mockApi(() =>
      json({
        ...summary,
        period: { ...summary.period, start: '2026-10-11T17:00:00Z', end: '2026-10-18T17:00:00Z' },
      }),
    );
    renderPage();
    await screen.findByText('Bima');
    expect(screen.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
  });

  it('memuat, menampilkan kegagalan, dan mencoba ulang rekap', async () => {
    let fail = true;
    mockApi(() =>
      fail ? errorResponse('UNAVAILABLE', 'Rekap belum tersedia', 503) : json(summary),
    );
    renderPage();
    expect(screen.getByText('Memuat rekap…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Rekap belum tersedia');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi rekap' }));
    expect(await screen.findByText('Bima')).toBeInTheDocument();
  });

  it('menampilkan keadaan roster kosong', async () => {
    mockApi(() => json({ ...summary, members: [] }));
    renderPage();
    expect(await screen.findByText(/Belum ada anggota/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kirim peringatan/ })).not.toBeInTheDocument();
  });

  it.each(['anggota', 'admin'] as const)('menolak peran %s tanpa mengambil rekap', async (role) => {
    profileState.profile = { id: 'other', role, fullName: 'Bukan advisor' };
    renderPage();
    expect(screen.getByText(/Halaman ini khusus advisor/)).toBeInTheDocument();
    await act(async () => {});
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/attendance/'))).toBe(
      false,
    );
  });

  it('tidak memuat rekap saat profil belum siap atau gagal', async () => {
    profileState.loading = true;
    const view = renderPage();
    expect(screen.getByText('Memuat profil…')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    profileState.loading = false;
    profileState.profile = null;
    view.rerender(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Profil gagal dimuat');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('respons periode lama tidak menimpa pilihan terbaru', async () => {
    let finishOld!: (value: Response) => void;
    mockApi((url) =>
      url.searchParams.get('period') === 'week'
        ? new Promise((resolve) => {
            finishOld = resolve;
          })
        : json({ ...summary, members: [{ ...member, fullName: 'Data terbaru' }] }),
    );
    renderPage();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Periode'), { target: { value: 'month' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tampilkan' }));
    await screen.findByText('Data terbaru');
    await act(async () => finishOld(json(summary)));
    expect(screen.queryByText('Bima')).not.toBeInTheDocument();
    expect(screen.getByText('Data terbaru')).toBeInTheDocument();
  });

  it('mengirim catatan terpangkas sekali saat klik ganda dan menampilkan sukses', async () => {
    let finishSend!: (value: Response) => void;
    mockApi((_url, init) =>
      init?.method === 'POST'
        ? new Promise((resolve) => {
            finishSend = resolve;
          })
        : json(summary),
    );
    renderPage();
    await screen.findByText('Bima');
    fireEvent.change(screen.getByLabelText('Catatan untuk Bima (opsional)'), {
      target: { value: '  Jadwalkan riset  ' },
    });
    await userEvent.setup().dblClick(warningButton());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({
      userId: 'member-1',
      note: 'Jadwalkan riset',
    });
    expect(screen.getByRole('button', { name: /Mengirim/ })).toBeDisabled();
    await act(async () => finishSend(json({ id: 'warning-1' }, 201)));
    expect(await screen.findByText('Peringatan terkirim untuk Bima.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sudah diperingatkan hari ini/ })).toBeDisabled();
  });

  it('catatan bersifat opsional', async () => {
    mockApi((_url, init) => json(init?.method === 'POST' ? { id: 'warning-1' } : summary));
    renderPage();
    await screen.findByText('Bima');
    expect(screen.getByLabelText('Catatan untuk Bima (opsional)')).toHaveAttribute(
      'maxlength',
      '1000',
    );
    await userEvent.setup().click(warningButton());
    await screen.findByText('Peringatan terkirim untuk Bima.');
    expect(JSON.parse(String(posts()[0][1]?.body)).note).toBe('');
  });

  it('konflik peringatan harian ditampilkan dan menahan pengiriman berikutnya', async () => {
    mockApi((_url, init) =>
      init?.method === 'POST'
        ? errorResponse(
            'WARNING_ALREADY_SENT',
            'Peringatan untuk anggota ini sudah dikirim hari ini',
          )
        : json(summary),
    );
    renderPage();
    await screen.findByText('Bima');
    await userEvent.setup().click(warningButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('sudah dikirim hari ini');
    expect(screen.getByRole('button', { name: /Sudah diperingatkan hari ini/ })).toBeDisabled();
    expect(screen.queryByText('Peringatan terkirim untuk Bima.')).not.toBeInTheDocument();
  });

  it('target yang sudah tercapai di server tidak dilaporkan sebagai sukses', async () => {
    mockApi((_url, init) =>
      init?.method === 'POST'
        ? errorResponse('TARGET_MET', 'Anggota sudah memenuhi target minggu berjalan')
        : json(summary),
    );
    renderPage();
    await screen.findByText('Bima');
    await userEvent.setup().click(warningButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('sudah memenuhi target');
    expect(screen.queryByText('Peringatan terkirim untuk Bima.')).not.toBeInTheDocument();
  });

  it('kegagalan jaringan mempertahankan catatan dan dapat dicoba lagi', async () => {
    let fail = true;
    mockApi((_url, init) =>
      init?.method === 'POST'
        ? fail
          ? Promise.reject(new Error('offline'))
          : json({ id: 'warning-1' }, 201)
        : json(summary),
    );
    renderPage();
    await screen.findByText('Bima');
    fireEvent.change(screen.getByLabelText('Catatan untuk Bima (opsional)'), {
      target: { value: 'Tetap tersimpan' },
    });
    await userEvent.setup().click(warningButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Koneksi gagal');
    expect(screen.getByLabelText('Catatan untuk Bima (opsional)')).toHaveValue('Tetap tersimpan');
    fail = false;
    await userEvent.setup().click(warningButton());
    expect(await screen.findByText('Peringatan terkirim untuk Bima.')).toBeInTheDocument();
  });
});
