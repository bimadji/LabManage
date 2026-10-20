import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../auth/useSession', () => ({
  useSession: () => ({ session: { access_token: 'test-token' }, loading: false }),
}));
const profileState: ProfileState = {
  profile: { id: 'member-1', role: 'anggota', fullName: 'Anggota' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const openSession = {
  id: 'session-1',
  userId: 'member-1',
  checkedInAt: '2026-10-19T16:30:00Z',
  checkedOutAt: null,
  durationMinutes: 90,
};
const closedSession = { ...openSession, checkedOutAt: '2026-10-19T18:00:00Z' };
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function mockApi(handle: (path: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/inventory/pending-count') return json(200, { total: 0 });
      return handle(path, init);
    }),
  );
}
function renderPage() {
  window.history.replaceState({}, '', '/kehadiran');
  return render(<App />);
}
beforeEach(() => {
  profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota' };
  profileState.loading = false;
  mockApi((path) => {
    expect(path).toBe('/attendance/me');
    return json(200, null);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Kehadiran dari navigasi aplikasi', () => {
  it('anggota tanpa sesi mendapat tombol check-in dari navigasi', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Check-in' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Kehadiran' })).toHaveAttribute('href', '/kehadiran');
    expect(screen.getByText(/belum ada sesi/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-out' })).not.toBeInTheDocument();
  });

  it('check-in dan check-out memakai API yang ada lalu menampilkan sesi terbaru', async () => {
    let current: typeof openSession | typeof closedSession | null = null;
    const paths: string[] = [];
    mockApi((path, init) => {
      if (init?.method === 'POST') {
        paths.push(path);
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-token');
        current = path.endsWith('check-in') ? openSession : closedSession;
        return json(path.endsWith('check-in') ? 201 : 200, current);
      }
      expect(path).toBe('/attendance/me');
      return json(200, current);
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Check-in' }));
    expect(await screen.findByRole('button', { name: 'Check-out' })).toBeEnabled();
    expect(screen.getByText('1 jam 30 menit')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/check-in berhasil/i);
    await user.click(screen.getByRole('button', { name: 'Check-out' }));
    expect(await screen.findByRole('button', { name: 'Check-in' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/check-out berhasil/i);
    expect(screen.getByText('1 jam 30 menit')).toBeInTheDocument();
    expect(paths).toEqual(['/attendance/check-in', '/attendance/check-out']);
  });

  it('memulihkan sesi aktif setelah halaman dibuka, tanggal dan waktu memakai WIB', async () => {
    mockApi(() => json(200, openSession));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Check-out' })).toBeEnabled();
    expect(screen.getByText(/23[.:]30 WIB/)).toBeInTheDocument();
    expect(screen.getByText(/19 Oktober 2026/)).toBeInTheDocument();
    expect(screen.getByText('1 jam 30 menit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
  });

  it('memperbarui durasi dari server setiap 30 detik dan berhenti setelah unmount', async () => {
    mockApi(() => json(200, openSession));
    const view = renderPage();
    await screen.findByText('1 jam 30 menit');
    vi.useFakeTimers();
    // Mount ulang agar interval komponen menggunakan clock test.
    view.unmount();
    const next = renderPage();
    await act(async () => {});
    mockApi(() => json(200, { ...openSession, durationMinutes: 91 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText('1 jam 31 menit')).toBeInTheDocument();
    next.unmount();
    const reads = vi.mocked(fetch).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(reads);
  });

  it('menampilkan loading dan error baca, lalu dapat mencoba lagi', async () => {
    let finish!: (response: Response) => void;
    mockApi(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/memuat sesi/i);
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () =>
      finish(json(500, { error: { code: 'INTERNAL', message: 'Sesi gagal dimuat' } })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi gagal dimuat');
    mockApi(() => json(200, null));
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('button', { name: 'Check-in' })).toBeEnabled();
  });

  it('mencegah pengiriman ganda dan tidak mengklaim berhasil saat API gagal', async () => {
    let finish!: (response: Response) => void;
    let writes = 0;
    mockApi((_path, init) => {
      if (!init?.method) return json(200, null);
      writes++;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const user = userEvent.setup();
    renderPage();
    await user.dblClick(await screen.findByRole('button', { name: 'Check-in' }));
    expect(screen.getByRole('button', { name: /memproses/i })).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () =>
      finish(json(500, { error: { code: 'INTERNAL', message: 'Gagal menyimpan' } })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal menyimpan');
    expect(await screen.findByRole('button', { name: 'Check-in' })).toBeEnabled();
    expect(screen.queryByText(/check-in berhasil/i)).not.toBeInTheDocument();
  });

  it.each([
    {
      initial: null,
      latest: openSession,
      action: 'Check-in',
      next: 'Check-out',
      status: 409,
      code: 'ALREADY_IN',
    },
    {
      initial: openSession,
      latest: closedSession,
      action: 'Check-out',
      next: 'Check-in',
      status: 404,
      code: 'NOT_IN',
    },
  ])(
    'menyinkronkan sesi saat aksi $action telah dilakukan di tab lain',
    async ({ initial, latest, action, next, status, code }) => {
      let current = initial;
      mockApi((_path, init) => {
        if (!init?.method) return json(200, current);
        current = latest;
        return json(status, { error: { code, message: 'Sesi sudah berubah di tab lain' } });
      });
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole('button', { name: action }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Sesi sudah berubah');
      expect(await screen.findByRole('button', { name: next })).toBeEnabled();
    },
  );

  it('gagal menyegarkan setelah check-in sukses tidak membuka check-in kedua', async () => {
    let saved = false;
    mockApi((_path, init) => {
      if (init?.method === 'POST') {
        saved = true;
        return json(201, openSession);
      }
      return saved
        ? json(500, { error: { code: 'INTERNAL', message: 'Tidak dapat memuat sesi terbaru' } })
        : json(200, null);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check-in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak dapat memuat sesi terbaru');
    expect(screen.getByRole('status')).toHaveTextContent(/check-in berhasil/i);
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeEnabled();
  });

  it('advisor mendapat penjelasan tanpa permintaan sesi atau tombol aksi', async () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
    renderPage();
    expect(await screen.findByText(/kehadiran pribadi.*anggota.*admin/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check-in|check-out/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('menunggu profil dan menolak aksi jika profil tidak tersedia', async () => {
    profileState.loading = true;
    profileState.profile = null;
    const view = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/memuat profil/i);
    profileState.loading = false;
    view.rerender(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/profil/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});
