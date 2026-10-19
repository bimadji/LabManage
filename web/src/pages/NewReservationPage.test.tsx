import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewReservationPage } from './NewReservationPage';

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
    <MemoryRouter>
      <NewReservationPage />
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
    release(jsonResponse(201, { id: 'res-1' }));
    await waitFor(() => expect(postedUrls()).toHaveLength(1));
  });
});
