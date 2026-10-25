import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import type { Reservation, Room } from '../types';
import { SchedulePage } from './SchedulePage';

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
const rooms: Room[] = [
  { id: 'a', name: 'Lab Robotik', kind: 'ruang' },
  { id: 'b', name: 'Ruang Diskusi', kind: 'ruang' },
];
const reservations: Reservation[] = [
  {
    id: '1',
    roomId: 'a',
    team: 'Tim Robot A',
    userId: 'user-a',
    startsAt: '2026-10-22T23:00:00Z',
    endsAt: '2026-10-23T00:00:00Z',
    status: 'aktif',
    createdAt: '2026-10-21T00:00:00Z',
  },
  {
    id: '2',
    roomId: 'b',
    team: 'Tim Robot B',
    userId: 'user-b',
    startsAt: '2026-10-23T02:00:00Z',
    endsAt: '2026-10-23T03:00:00Z',
    status: 'dibatalkan',
    createdAt: '2026-10-21T00:00:00Z',
  },
];
function renderPage() {
  return render(
    <MemoryRouter>
      <SchedulePage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/rooms') return rooms;
    if (path.startsWith('/reservations?')) return reservations;
    throw new Error(`Endpoint tidak diharapkan: ${path}`);
  });
});

describe('SchedulePage', () => {
  it('mengumumkan proses pemuatan tanpa menampilkan kondisi kosong', () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat jadwal');
    expect(screen.queryByText(/Belum ada reservasi/)).not.toBeInTheDocument();
  });

  it('menampilkan waktu dan kelompok hari WIB serta label status tiap reservasi', async () => {
    renderPage();
    await screen.findByText('Tim Robot A');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Jumat, 23 Oktober 2026');
    expect(screen.getByText(/Semua jam.*WIB/)).toBeInTheDocument();
    const entries = screen.getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('06.00–07.00');
    expect(within(entries[0]).getByText('Aktif')).toBeInTheDocument();
    expect(within(entries[1]).getByText('Dibatalkan')).toBeInTheDocument();
  });

  it('filter ruang tetap membatasi daftar, termasuk reservasi yang dibatalkan', async () => {
    renderPage();
    await screen.findByText('Tim Robot A');
    fireEvent.change(screen.getByLabelText('Ruang'), { target: { value: 'b' } });
    expect(screen.queryByText('Tim Robot A')).not.toBeInTheDocument();
    expect(screen.getByText('Tim Robot B')).toBeInTheDocument();
    expect(screen.getByText('Dibatalkan')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ruang'), { target: { value: 'semua' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('kondisi kosong menyediakan aksi menuju form reservasi', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) => (path === '/rooms' ? rooms : []));
    renderPage();
    await screen.findByText(/Belum ada reservasi/);
    expect(screen.getByRole('link', { name: 'Buat reservasi' })).toHaveAttribute(
      'href',
      '/reservasi/baru',
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('kegagalan memuat diumumkan sebagai error, bukan jadwal kosong', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Jadwal gagal dimuat');
    expect(screen.queryByText(/Belum ada reservasi/)).not.toBeInTheDocument();
  });

  it('memuat ulang ruang dan reservasi serta mempertahankan filter setelah gagal', async () => {
    const user = userEvent.setup();
    let reservationAttempts = 0;
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (path === '/rooms') return rooms;
      if (path.startsWith('/reservations?')) {
        reservationAttempts += 1;
        if (reservationAttempts === 1) throw new Error('Offline');
        return reservations;
      }
      throw new Error(`Endpoint tidak diharapkan: ${path}`);
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Jadwal gagal dimuat');
    await user.selectOptions(screen.getByLabelText('Ruang'), 'b');
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Tim Robot B')).toBeInTheDocument();
    expect(screen.queryByText('Tim Robot A')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ruang')).toHaveValue('b');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(4);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/rooms');
  });
});
