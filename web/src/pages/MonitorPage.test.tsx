import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import { MonitorPage } from './MonitorPage';

vi.mock('../auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'admin-1', role: 'admin', fullName: 'Admin' },
    loading: false,
  }),
}));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
let onSubscription: ((state: string) => void) | undefined;
vi.mock('../lib/supabase', () => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockImplementation((callback: (state: string) => void) => {
    onSubscription = callback;
    return channel;
  });
  return {
    supabaseClient: () => ({ channel: vi.fn(() => channel), removeChannel: vi.fn() }),
  };
});
const session = {
  id: 'a1',
  userId: 'u1',
  checkedInAt: '2026-10-26T04:45:00Z',
  checkedOutAt: null,
  fullName: 'Bima',
  durationMinutes: 90,
  overNightLimit: false,
};
const renderPage = () =>
  render(
    <MemoryRouter>
      <MonitorPage />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Monitoring lab', () => {
  it('menghitung durasi live dari checkedInAt, bukan snapshot durationMinutes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-26T05:30:00Z'));
    vi.mocked(apiFetch).mockResolvedValue([session]);
    renderPage();
    await act(async () => {});
    const list = screen.getByRole('list', { name: 'Anggota yang sedang di lab' });
    expect(within(list).getByText('45 menit')).toBeInTheDocument();
    expect(within(list).queryByText('1 jam 30 menit')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kondisi laboratorium saat ini')).toHaveTextContent('1');
    act(() => vi.advanceTimersByTime(60_000));
    expect(within(list).getByText('46 menit')).toBeInTheDocument();
  });

  it('menampilkan gangguan channel tanpa membuat daftar live menghilang', async () => {
    vi.mocked(apiFetch).mockResolvedValue([{ ...session, durationMinutes: 45 }]);
    renderPage();
    expect(await screen.findByText('Bima')).toBeInTheDocument();
    act(() => onSubscription?.('CHANNEL_ERROR'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Koneksi pembaruan langsung terganggu',
    );
    expect(screen.getByRole('list', { name: 'Anggota yang sedang di lab' })).toHaveTextContent(
      'Bima',
    );
  });

  it('member list has an accessible name and member names remain headings', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([session]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Bima')).toBeInTheDocument());
    expect(screen.getByRole('list', { name: 'Anggota yang sedang di lab' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Bima' })).toBeInTheDocument();
  });
});
