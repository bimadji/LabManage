import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const unread = {
  id: 'notice-1',
  kind: 'lembur',
  message: 'Sesi Anda melewati batas malam.',
  readAt: null,
  createdAt: '2026-10-20T15:00:00Z',
};
const read = {
  id: 'notice-2',
  kind: 'laporan',
  message: 'Laporan lampu ditindaklanjuti.',
  readAt: '2026-10-20T10:00:00Z',
  createdAt: '2026-10-20T09:00:00Z',
};
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
  window.history.replaceState({}, '', '/notifikasi');
  return render(<App />);
}
beforeEach(() => {
  profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota' };
  profileState.loading = false;
  mockApi((path, init) => {
    expect(path).toBe('/notifications');
    expect(init?.method ?? 'GET').toBe('GET');
    return json(200, [unread, read]);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('Notifikasi pribadi dari navigasi aplikasi', () => {
  it('memperlihatkan daftar dari API, jenis, waktu WIB, dan status baca', async () => {
    renderPage();
    expect(await screen.findByText(unread.message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifikasi' })).toHaveAttribute('href', '/notifikasi');
    const cards = within(screen.getByRole('list', { name: 'Daftar notifikasi' })).getAllByRole(
      'listitem',
    );
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent(unread.message);
    expect(cards[0]).toHaveTextContent('Lembur');
    expect(cards[0]).toHaveTextContent(/22[.:]00 WIB/);
    expect(cards[0]).toHaveTextContent(/20 Oktober 2026/);
    expect(cards[0]).toHaveTextContent('Belum dibaca');
    expect(cards[1]).toHaveTextContent('Sudah dibaca');
    expect(within(cards[0]).getByRole('article', { name: 'Lembur' })).toHaveTextContent(
      unread.message,
    );
    expect(within(cards[1]).getByRole('article', { name: 'Laporan fasilitas' })).toHaveTextContent(
      read.message,
    );
    expect(within(cards[1]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('menandai satu notifikasi dibaca melalui PATCH dan mempertahankan notifikasi lainnya', async () => {
    let changed = false;
    mockApi((path, init) => {
      if (init?.method === 'PATCH') {
        expect(path).toBe('/notifications/notice-1/read');
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-token');
        changed = true;
        return json(200, { ...unread, readAt: '2026-10-20T16:00:00Z' });
      }
      return json(200, [unread, read]);
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tandai sudah dibaca' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/ditandai.*dibaca/i);
    expect(changed).toBe(true);
    expect(screen.getAllByText('Sudah dibaca')).toHaveLength(2);
    expect(screen.getByText(read.message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai sudah dibaca' })).not.toBeInTheDocument();
  });

  it('menampilkan loading dan kegagalan daftar, lalu memuat daftar kosong saat mencoba lagi', async () => {
    let finish!: (response: Response) => void;
    mockApi(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/memuat notifikasi/i);
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () =>
      finish(json(500, { error: { code: 'INTERNAL', message: 'Daftar gagal dimuat' } })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Daftar gagal dimuat');
    mockApi(() => json(200, []));
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText(/belum ada notifikasi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeEnabled();
  });

  it('gagal menandai tidak mengubah status baca dan pengguna dapat mengulangi aksinya', async () => {
    let writes = 0;
    mockApi((_path, init) => {
      if (init?.method !== 'PATCH') return json(200, [unread]);
      writes++;
      return writes === 1
        ? json(500, { error: { code: 'INTERNAL', message: 'Status gagal disimpan' } })
        : json(200, { ...unread, readAt: '2026-10-20T16:00:00Z' });
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tandai sudah dibaca' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Status gagal disimpan');
    expect(screen.getByText('Belum dibaca')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tandai sudah dibaca' }));
    expect(await screen.findByText('Sudah dibaca')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mencegah klik ganda dan muat ulang selama perubahan status masih diproses', async () => {
    let finish!: (response: Response) => void;
    let writes = 0;
    mockApi((_path, init) => {
      if (init?.method !== 'PATCH') return json(200, [unread]);
      writes++;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const user = userEvent.setup();
    renderPage();
    await user.dblClick(await screen.findByRole('button', { name: 'Tandai sudah dibaca' }));
    expect(screen.getByRole('button', { name: /menyimpan/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () => finish(json(200, { ...unread, readAt: '2026-10-20T16:00:00Z' })));
    expect(await screen.findByText('Sudah dibaca')).toBeInTheDocument();
  });

  it('muat ulang mengambil notifikasi baru dan status baca terbaru dari server', async () => {
    renderPage();
    await screen.findByText(unread.message);
    mockApi(() =>
      json(200, [
        { ...unread, readAt: '2026-10-20T16:00:00Z' },
        {
          ...read,
          id: 'notice-3',
          kind: 'inventaris',
          message: 'Pinjaman disetujui.',
        },
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    expect(await screen.findByText('Pinjaman disetujui.')).toBeInTheDocument();
    expect(screen.queryByText('Belum dibaca')).not.toBeInTheDocument();
  });

  it.each(['admin', 'advisor'] as const)(
    '%s dapat membaca dan menandai notifikasi pribadinya',
    async (role) => {
      profileState.profile = { id: `${role}-1`, role, fullName: role };
      renderPage();
      expect(await screen.findByText(unread.message)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tandai sudah dibaca' })).toBeEnabled();
    },
  );

  it('menunggu profil dan tidak meminta notifikasi saat profil gagal', async () => {
    profileState.profile = null;
    profileState.loading = true;
    const view = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/memuat profil/i);
    profileState.loading = false;
    view.rerender(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/profil/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('respons profil lama tidak menimpa daftar setelah pengguna berganti', async () => {
    let finish!: (response: Response) => void;
    mockApi(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderPage();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    profileState.profile = { id: 'member-2', role: 'anggota', fullName: 'Anggota lain' };
    mockApi(() => json(200, []));
    view.rerender(<App />);
    expect(await screen.findByText(/belum ada notifikasi/i)).toBeInTheDocument();
    await act(async () => finish(json(200, [unread])));
    expect(screen.queryByText(unread.message)).not.toBeInTheDocument();
  });
});
