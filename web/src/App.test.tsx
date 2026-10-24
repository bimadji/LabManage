import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const sessionState = { session: null as unknown, loading: false };
const profileState = {
  profile: { id: 'member-1', role: 'anggota' as const, fullName: 'Anggota' },
  loading: false,
};
const signIn = vi.fn();

vi.mock('../src/auth/useSession', () => ({ useSession: () => sessionState }));
vi.mock('../src/auth/useProfile', () => ({ useProfile: () => profileState }));

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
    window.history.replaceState({}, '', '/');
  });

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
    expect(screen.getByRole('link', { name: 'Monitoring' })).toHaveAttribute('href', '/monitor');
    expect(screen.getByRole('link', { name: 'Kehadiran' })).toHaveAttribute('href', '/kehadiran');
    expect(screen.getByRole('link', { name: 'Laporan' })).toHaveAttribute(
      'href',
      '/laporan-fasilitas',
    );
    expect(screen.getByRole('link', { name: 'Notifikasi' })).toHaveAttribute('href', '/notifikasi');
  });
});
