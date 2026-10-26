import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { Profile } from '../src/auth/useProfile';
import { apiFetch } from '../src/lib/api';

const sessionState = { session: null as unknown, loading: false };
const profileState: { profile: Profile; loading: boolean } = {
  profile: { id: 'member-1', role: 'anggota', fullName: 'Anggota' },
  loading: false,
};
const signIn = vi.fn();

vi.mock('../src/auth/useSession', () => ({ useSession: () => sessionState }));
vi.mock('../src/auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../src/lib/api', () => ({ apiFetch: vi.fn() }));

// App renders the auth gate, which reads a Supabase session.
vi.mock('../src/lib/supabase', () => ({
  supabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: signIn,
      signOut: async () => ({ error: null }),
    },
  }),
}));

describe('App', () => {
  beforeEach(() => {
    sessionState.session = null;
    sessionState.loading = false;
    profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota' };
    profileState.loading = false;
    signIn.mockReset().mockResolvedValue({ error: null });
    vi.mocked(apiFetch)
      .mockReset()
      .mockImplementation(async (path) => {
        if (path === '/inventory/pending-count') return { total: 0 };
        if (path === '/rooms' || path.startsWith('/reservations?')) return [];
        throw new Error(`Endpoint tidak diharapkan: ${path}`);
      });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response),
    );
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function enterApp(path = '/jadwal') {
    window.history.replaceState({}, '', path);
    sessionState.session = { access_token: 'test-token' };
    return render(<App />);
  }

  it('mengumumkan status saat sesi autentikasi sedang dimuat', () => {
    sessionState.loading = true;
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/memuat/i);
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('menampilkan layar masuk saat belum ada sesi', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'LabManage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('menampilkan kesalahan autentikasi sebagai alert dan mengaktifkan ulang tombol', async () => {
    signIn.mockResolvedValueOnce({ error: new Error('invalid credentials') });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Email'), 'anggota@example.test');
    await user.type(screen.getByLabelText('Kata sandi'), 'kata-sandi-salah');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau kata sandi salah.');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  });

  it('menonaktifkan tombol masuk selama permintaan autentikasi berlangsung', async () => {
    let finishSignIn!: (result: { error: null }) => void;
    signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSignIn = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Email'), 'anggota@example.test');
    await user.type(screen.getByLabelText('Kata sandi'), 'kata-sandi');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(screen.getByRole('button', { name: /memproses/i })).toBeDisabled();
    await act(async () => finishSignIn({ error: null }));
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  });

  it('menyediakan navigasi utama dengan tautan bernama untuk seluruh halaman bersama', async () => {
    sessionState.session = { user: { id: 'member-1' } };
    window.history.replaceState({}, '', '/__audit');
    render(<App />);

    const navigation = await screen.findByRole('navigation', { name: 'Navigasi utama' });
    expect(navigation).toHaveAccessibleName('Navigasi utama');
    expect(screen.getByRole('link', { name: 'Jadwal' })).toHaveAttribute('href', '/jadwal');
    expect(screen.getByRole('link', { name: 'Reservasi' })).toHaveAttribute(
      'href',
      '/reservasi/baru',
    );
    expect(screen.getByRole('link', { name: 'Inventaris' })).toHaveAttribute('href', '/inventaris');
    expect(screen.queryByRole('link', { name: 'Monitoring' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kehadiran' })).toHaveAttribute('href', '/kehadiran');
    expect(screen.getByRole('link', { name: 'Laporan' })).toHaveAttribute(
      'href',
      '/laporan-fasilitas',
    );
    expect(screen.getByRole('link', { name: 'Notifikasi' })).toHaveAttribute('href', '/notifikasi');
  });

  it('menolak anggota yang membuka route Monitoring secara langsung', async () => {
    profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota' };
    enterApp('/monitor');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Halaman tidak tersedia' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kelola kehadiran' })).not.toBeInTheDocument();
  });

  it('menampilkan Monitoring untuk admin dan advisor', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin' };
    sessionState.session = { user: { id: 'admin-1' } };
    window.history.replaceState({}, '', '/jadwal');
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Monitoring' })).toHaveAttribute(
      'href',
      '/monitor',
    );
  });

  it('menyediakan skip link dan satu landmark utama pada halaman kerja', async () => {
    enterApp('/jadwal');
    expect(screen.getByRole('link', { name: 'Lewati ke konten utama' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(await screen.findByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Jadwal');
  });

  it('membuka, menutup, dan mereset navigasi mobile setelah perpindahan route', async () => {
    const user = userEvent.setup();
    enterApp('/jadwal');
    const toggle = await screen.findByRole('button', { name: 'Buka navigasi' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'main-navigation');
    const navigation = screen.getByRole('navigation', { name: 'Navigasi utama' });
    expect(navigation).toHaveAttribute('id', 'main-navigation');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(navigation).getByRole('link', { name: 'Inventaris' }));
    expect(screen.getByRole('button', { name: 'Buka navigasi' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(window.location.pathname).toBe('/inventaris');
  });

  it('menampilkan identitas role dan menempatkan badge pada Kotak masuk admin', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Robotik' };
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/inventory/pending-count' ? { total: 2 } : [],
    );
    enterApp('/inventaris');
    expect(await screen.findByText('Admin Robotik')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Navigasi utama' });
    const inbox = await within(navigation).findByRole('link', { name: /Kotak masuk/ });
    expect(inbox).toHaveAccessibleName('Kotak masuk 2 permintaan pending');
    expect(inbox).toHaveAttribute('href', '/inventaris/kotak-masuk');
    expect(within(inbox).getByText('2')).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Tambah item' })).toHaveAttribute(
      'href',
      '/inventaris/baru',
    );
  });

  it('menyediakan subtautan sesuai role yang sah tanpa menambah tujuan utama', async () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Pembimbing Robotik' };
    enterApp('/inventaris');
    const navigation = screen.getByRole('navigation', { name: 'Navigasi utama' });
    expect(
      await within(navigation).findByRole('link', { name: 'Kotak masuk' }),
    ).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Tambah item' })).not.toBeInTheDocument();
    expect(
      await within(navigation).findByRole('link', { name: 'Rekap per anggota' }),
    ).toHaveAttribute('href', '/monitor/rekap');
    expect(screen.queryByRole('link', { name: 'Kelola kehadiran' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Navigasi utama' })).getAllByRole('listitem'),
    ).toHaveLength(7);
  });

  it('menutup menu ketika brand dipilih pada route Jadwal yang sama', async () => {
    const user = userEvent.setup();
    enterApp('/jadwal');
    const brand = await screen.findByRole('link', { name: 'LabManage, buka Jadwal' });
    const toggle = screen.getByRole('button', { name: 'Buka navigasi' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    brand.focus();
    await user.click(brand);

    expect(window.location.pathname).toBe('/jadwal');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(brand);
  });

  it('mempertahankan fokus navigasi dan identitas akun setelah perpindahan route', async () => {
    profileState.profile = { id: 'member-1', role: 'anggota', fullName: 'Anggota Demo' };
    const user = userEvent.setup();
    enterApp('/jadwal');
    const navigation = await screen.findByRole('navigation', { name: 'Navigasi utama' });
    const inventoryLink = within(navigation).getByRole('link', { name: 'Inventaris' });
    inventoryLink.focus();

    await user.click(inventoryLink);

    expect(window.location.pathname).toBe('/inventaris');
    expect(document.activeElement).toBe(inventoryLink);
    expect(screen.getByText('Anggota Demo')).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Permintaan saya' })).toBeInTheDocument();
  });

  it('memberikan aria-current pada tujuan yang sesuai dengan route aktif', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Robotik' };
    enterApp('/inventaris/kotak-masuk');
    expect(
      await within(screen.getByRole('navigation', { name: 'Navigasi utama' })).findByRole('link', {
        name: /Kotak masuk/,
      }),
    ).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Inventaris' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
