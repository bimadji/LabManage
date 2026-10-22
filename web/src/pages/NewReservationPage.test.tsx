import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewReservationPage } from './NewReservationPage';

// The form renders without a real Supabase client; apiFetch is stubbed via fetch.
vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const ROOMS = [{ id: 'room-1', name: 'Ruang Robotik A', kind: 'ruang' }];

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reservasi/baru']}>
      <Routes>
        <Route path="/reservasi/baru" element={<NewReservationPage />} />
        <Route path="/jadwal" element={<h1>Jadwal</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function postedUrls() {
  const mock = vi.mocked(fetch);
  return mock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.endsWith('/reservations'));
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith('/rooms')) return jsonResponse(200, ROOMS);
      return jsonResponse(201, { id: 'res-1' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillForm(startsAt: string, endsAt: string) {
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole('option', { name: 'Ruang Robotik A' });
  await user.type(screen.getByLabelText('Tim'), 'Robotik');
  await user.type(screen.getByLabelText('Mulai'), startsAt);
  await user.type(screen.getByLabelText('Selesai'), endsAt);
  await user.click(screen.getByRole('button', { name: 'Simpan reservasi' }));
  return user;
}

describe('NewReservationPage', () => {
  it('mengumumkan daftar ruang sedang dimuat dan mencegah pengiriman prematur', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat daftar ruang');
    expect(screen.getByLabelText('Ruang atau alat')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simpan reservasi' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('menjelaskan daftar ruang kosong dan menahan pengiriman tanpa pilihan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, [])),
    );
    renderPage();
    expect(await screen.findByText(/Belum ada ruang atau alat/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ruang atau alat')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simpan reservasi' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Kembali ke jadwal' })).toHaveAttribute(
      'href',
      '/jadwal',
    );
    expect(postedUrls()).toHaveLength(0);
  });

  it('menahan pengiriman jika daftar ruang gagal dimuat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, {})),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Daftar ruang gagal dimuat');
    expect(screen.getByRole('button', { name: 'Simpan reservasi' })).toBeDisabled();
    expect(screen.queryByText(/Belum ada ruang atau alat/)).not.toBeInTheDocument();
  });

  it('menolak waktu selesai <= mulai tanpa mengirim request', async () => {
    await fillForm('2026-10-20T10:00', '2026-10-20T09:00');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Waktu selesai harus setelah waktu mulai.',
    );
    expect(postedUrls()).toHaveLength(0);
  });

  it('menampilkan pesan 409 dari API di bawah form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/rooms')) return jsonResponse(200, ROOMS);
        return jsonResponse(409, {
          error: { code: 'CONFLICT', message: 'Ruang sudah dipesan pada rentang waktu tersebut' },
        });
      }),
    );

    await fillForm('2026-10-20T09:00', '2026-10-20T10:00');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ruang sudah dipesan pada rentang waktu tersebut',
    );
    expect(postedUrls()).toHaveLength(1);
  });

  it('menonaktifkan tombol selama request berjalan', async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/rooms')) return jsonResponse(200, ROOMS);
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }),
    );

    await fillForm('2026-10-20T09:00', '2026-10-20T10:00');

    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled();
    expect(screen.getByLabelText('Tim')).toBeDisabled();
    expect(screen.getByLabelText('Mulai')).toBeDisabled();
    expect(screen.getByLabelText('Selesai')).toBeDisabled();
    release(jsonResponse(201, { id: 'res-1' }));
    await screen.findByRole('heading', { name: 'Jadwal' });
    expect(postedUrls()).toHaveLength(1);
  });

  it('mempertahankan isian setelah kegagalan simpan agar bisa dicoba kembali', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/rooms')) return jsonResponse(200, ROOMS);
        attempts++;
        return attempts === 1
          ? jsonResponse(409, { error: { code: 'CONFLICT', message: 'Ruang sudah dipesan' } })
          : jsonResponse(201, { id: 'res-1' });
      }),
    );
    const user = await fillForm('2026-10-20T09:00', '2026-10-20T10:00');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Tim')).toHaveValue('Robotik');
    expect(screen.getByLabelText('Mulai')).toHaveValue('2026-10-20T09:00');
    expect(screen.getByLabelText('Selesai')).toHaveValue('2026-10-20T10:00');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Simpan reservasi' })).toBeEnabled(),
    );
    expect(screen.getByLabelText('Tim')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Simpan reservasi' }));
    expect(await screen.findByRole('heading', { name: 'Jadwal' })).toBeInTheDocument();
    expect(postedUrls()).toHaveLength(2);
  });
});
