import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../auth/useSession', () => ({
  useSession: () => ({ session: { access_token: 'test-token' }, loading: false }),
}));

const profileState: ProfileState = {
  profile: { id: 'member-1', role: 'anggota', fullName: 'Anggota Demo' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const report = {
  id: 'report-1',
  category: 'lampu',
  description: 'Lampu meja solder berkedip',
  location: 'Meja solder',
  reportedBy: 'member-1',
  status: 'baru',
  createdAt: '2026-10-19T03:00:00.000Z',
  updatedAt: '2026-10-19T03:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(handle: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/inventory/pending-count') return jsonResponse(200, { total: 0 });
      return handle(url, init);
    }),
  );
}

function renderPage() {
  window.history.replaceState({}, '', '/laporan-fasilitas');
  return render(<App />);
}

beforeEach(() => {
  profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota Demo' };
  profileState.loading = false;
  mockApi((url, init) => {
    if (url.pathname === '/facility-reports' && !init?.method) return jsonResponse(200, [report]);
    throw new Error(`Permintaan tidak diharapkan: ${init?.method ?? 'GET'} ${url.pathname}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Laporan fasilitas dari navigasi aplikasi', () => {
  it('anggota membuka halaman, melihat laporannya, dan tidak mendapat aksi admin', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Laporan fasilitas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Laporan' })).toHaveAttribute(
      'href',
      '/laporan-fasilitas',
    );
    expect(await screen.findByText('Lampu meja solder berkedip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim laporan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tindak lanjuti' })).not.toBeInTheDocument();
  });

  it('anggota mengirim kategori, lokasi, deskripsi yang sudah dirapikan dan melihat laporan baru', async () => {
    let sent: unknown;
    mockApi((url, init) => {
      if (url.pathname !== '/facility-reports') throw new Error('Endpoint salah');
      if (init?.method !== 'POST') return jsonResponse(200, []);
      sent = JSON.parse(String(init.body));
      return jsonResponse(201, { ...report, ...(sent as object) });
    });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByLabelText('Kategori'), 'ventilasi');
    await user.type(screen.getByLabelText('Lokasi'), '  Ruang Robotik B  ');
    await user.type(screen.getByLabelText('Deskripsi'), '  Kipas tidak berputar  ');
    await user.click(screen.getByRole('button', { name: 'Kirim laporan' }));
    expect(await screen.findByText('Kipas tidak berputar')).toBeInTheDocument();
    expect(sent).toEqual({
      category: 'ventilasi',
      location: 'Ruang Robotik B',
      description: 'Kipas tidak berputar',
    });
    expect(screen.getByRole('status')).toHaveTextContent(/berhasil/i);
    expect(screen.getByLabelText('Deskripsi')).toHaveValue('');
  });

  it.each([
    { location: '   ', description: 'Lampu rusak', error: /lokasi wajib/i },
    { location: 'Ruang A', description: ' mati ', error: /5.*1000/ },
    { location: 'Ruang A', description: 'x'.repeat(1001), error: /5.*1000/ },
  ])(
    'menolak input tidak valid sebelum mengirim: $location / $error',
    async ({ location, description, error }) => {
      let writes = 0;
      mockApi((_url, init) => {
        if (init?.method) writes += 1;
        return jsonResponse(200, []);
      });
      renderPage();
      fireEvent.change(await screen.findByLabelText('Lokasi'), { target: { value: location } });
      fireEvent.change(screen.getByLabelText('Deskripsi'), { target: { value: description } });
      fireEvent.click(screen.getByRole('button', { name: 'Kirim laporan' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(error);
      expect(writes).toBe(0);
    },
  );

  it('advisor membaca semua laporan tanpa form atau aksi tulis', async () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
    renderPage();
    expect(await screen.findByText('Lampu meja solder berkedip')).toBeInTheDocument();
    expect(screen.queryByLabelText('Kategori')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /kirim laporan|tindak lanjuti|tandai selesai/i }),
    ).not.toBeInTheDocument();
  });

  it('admin mengikuti alur baru ke ditindaklanjuti ke selesai tanpa aksi berikutnya', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin' };
    const statuses: string[] = [];
    mockApi((url, init) => {
      if (!init?.method) return jsonResponse(200, [report]);
      expect(url.pathname).toBe('/facility-reports/report-1/status');
      expect(init.method).toBe('PATCH');
      const { status } = JSON.parse(String(init.body));
      statuses.push(status);
      return jsonResponse(200, { ...report, status });
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tindak lanjuti' }));
    expect(await screen.findByText('Ditindaklanjuti')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tandai selesai' }));
    expect(await screen.findByText('Selesai', { exact: true })).toBeInTheDocument();
    expect(statuses).toEqual(['ditindaklanjuti', 'selesai']);
    expect(
      screen.queryByRole('button', { name: /tindak lanjuti|tandai selesai/i }),
    ).not.toBeInTheDocument();
  });

  it('menampilkan kegagalan perubahan status tanpa mengubah status laporan', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin' };
    mockApi((_url, init) =>
      init?.method
        ? jsonResponse(422, {
            error: {
              code: 'INVALID_TRANSITION',
              message: 'Status laporan sudah berubah. Muat ulang halaman.',
            },
          })
        : jsonResponse(200, [report]),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tindak lanjuti' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Status laporan sudah berubah');
    expect(screen.getByText('Baru', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tindak lanjuti' })).toBeEnabled();
  });

  it('memperlihatkan pemuatan, kegagalan daftar, lalu dapat mencoba lagi sampai kosong', async () => {
    let finishLoading!: (response: Response) => void;
    mockApi(
      () =>
        new Promise<Response>((resolve) => {
          finishLoading = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/memuat laporan/i);
    await waitFor(() => expect(finishLoading).toBeTypeOf('function'));
    await act(async () =>
      finishLoading(
        jsonResponse(500, { error: { code: 'INTERNAL', message: 'Layanan tidak tersedia' } }),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Layanan tidak tersedia');
    mockApi(() => jsonResponse(200, []));
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText(/belum ada laporan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim laporan' })).toBeInTheDocument();
  });

  it('mempertahankan input saat kirim gagal dan mencegah pengiriman ganda selama menunggu', async () => {
    let finishSending!: (response: Response) => void;
    let writes = 0;
    mockApi((_url, init) => {
      if (!init?.method) return jsonResponse(200, []);
      writes += 1;
      return new Promise<Response>((resolve) => {
        finishSending = resolve;
      });
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Lokasi'), 'Ruang A');
    await user.type(screen.getByLabelText('Deskripsi'), 'Lampu tidak menyala');
    await user.dblClick(screen.getByRole('button', { name: 'Kirim laporan' }));
    expect(screen.getByRole('button', { name: /mengirim/i })).toBeDisabled();
    expect(writes).toBe(1);
    await act(async () =>
      finishSending(
        jsonResponse(500, { error: { code: 'INTERNAL', message: 'Laporan gagal disimpan' } }),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Laporan gagal disimpan');
    expect(screen.getByLabelText('Deskripsi')).toHaveValue('Lampu tidak menyala');
    expect(screen.getByRole('button', { name: 'Kirim laporan' })).toBeEnabled();
  });

  it('menunggu profil dan tidak menampilkan aksi tulis ketika profil gagal dimuat', async () => {
    profileState.loading = true;
    profileState.profile = null;
    const view = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/memuat profil/i);
    expect(screen.queryByRole('button', { name: 'Kirim laporan' })).not.toBeInTheDocument();
    profileState.loading = false;
    view.rerender(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/profil/i);
    expect(within(screen.getByRole('main')).queryByRole('form')).not.toBeInTheDocument();
  });
});
