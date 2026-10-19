import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryInboxPage } from './InventoryInboxPage';
import type { ComponentRequest, LoanRequest } from '../types';

vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const profileState = {
  profile: { id: 'admin-1', role: 'admin', fullName: 'Admin Demo' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({
  useProfile: () => profileState,
}));

const COMPONENTS: ComponentRequest[] = [
  {
    id: 'comp-1',
    itemId: 'item-1',
    itemName: 'Resistor 220 Ohm',
    userId: 'user-1',
    requesterName: 'Anggota Demo',
    qty: 5,
    note: 'untuk proyek line follower',
    status: 'menunggu',
    adminNote: null,
    decidedBy: null,
    decidedAt: null,
    adminReadAt: null,
    createdAt: '2026-10-19T04:00:00Z',
  },
  {
    id: 'comp-2',
    itemId: 'item-2',
    itemName: 'Kabel Jumper',
    userId: 'user-1',
    requesterName: 'Anggota Demo',
    qty: 10,
    note: null,
    status: 'dikonfirmasi',
    adminNote: null,
    decidedBy: 'admin-1',
    decidedAt: '2026-10-19T05:00:00Z',
    adminReadAt: '2026-10-19T05:00:00Z',
    createdAt: '2026-10-19T04:30:00Z',
  },
];

const LOANS: LoanRequest[] = [
  {
    id: 'loan-1',
    itemId: 'item-3',
    itemName: 'Osiloskop Rigol DS1054Z',
    userId: 'user-1',
    requesterName: 'Anggota Demo',
    purpose: 'kalibrasi sensor',
    expectedReturnAt: '2026-11-01',
    status: 'menunggu',
    adminNote: null,
    decidedBy: null,
    decidedAt: null,
    adminReadAt: null,
    createdAt: '2026-10-19T04:10:00Z',
  },
];

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let readPaths: string[] = [];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inventaris/kotak-masuk']}>
      <InventoryInboxPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Demo' };
  readPaths = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/component-requests')) {
        return jsonResponse(200, COMPONENTS);
      }
      if (path.endsWith('/loan-requests')) {
        return jsonResponse(200, LOANS);
      }
      if (init?.method === 'PATCH' && path.endsWith('/read')) {
        readPaths.push(path);
        return jsonResponse(200, {});
      }
      return jsonResponse(200, {});
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InventoryInboxPage', () => {
  it('admin melihat tombol konfirmasi, tolak, dan setujui', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Resistor 220 Ohm');
    expect(screen.getByRole('button', { name: 'Konfirmasi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Jenis permintaan'), 'pinjam');
    expect(await screen.findByRole('button', { name: 'Setujui' })).toBeInTheDocument();
  });

  it('advisor melihat daftar tanpa tombol aksi', async () => {
    profileState.profile = { id: 'adv-1', role: 'advisor', fullName: 'Advisor Demo' };
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Resistor 220 Ohm');
    expect(screen.queryByRole('button', { name: 'Konfirmasi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tolak' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Jenis permintaan'), 'pinjam');
    await screen.findByText('Osiloskop Rigol DS1054Z');
    expect(screen.queryByRole('button', { name: 'Setujui' })).not.toBeInTheDocument();
  });

  it('Konfirmasi memanggil endpoint confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Resistor 220 Ohm');

    await user.click(screen.getByRole('button', { name: 'Konfirmasi' }));

    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(
          ([url, init]) =>
            String(url).endsWith('/component-requests/comp-1/confirm') && init?.method === 'PATCH',
        );
      expect(call).toBeDefined();
    });
  });

  it('Setujui memanggil endpoint approve', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Resistor 220 Ohm');
    await user.selectOptions(screen.getByLabelText('Jenis permintaan'), 'pinjam');

    await user.click(await screen.findByRole('button', { name: 'Setujui' }));

    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(
          ([url, init]) =>
            String(url).endsWith('/loan-requests/loan-1/approve') && init?.method === 'PATCH',
        );
      expect(call).toBeDefined();
    });
  });

  it('menandai permintaan menunggu sebagai dibaca, lalu penanda hilang', async () => {
    // Server membalas dengan adminReadAt terisi setelah baris ditandai dibaca.
    let read = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (init?.method === 'PATCH' && path.endsWith('/read')) {
          read = true;
          readPaths.push(path);
          return jsonResponse(200, {});
        }
        if (path.endsWith('/component-requests')) {
          return jsonResponse(
            200,
            COMPONENTS.map((row) =>
              read && row.status === 'menunggu'
                ? { ...row, adminReadAt: '2026-10-19T06:00:00Z' }
                : row,
            ),
          );
        }
        if (path.endsWith('/loan-requests')) {
          return jsonResponse(
            200,
            LOANS.map((row) => (read ? { ...row, adminReadAt: '2026-10-19T06:00:00Z' } : row)),
          );
        }
        return jsonResponse(200, {});
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(readPaths).toContain('http://localhost:4000/component-requests/comp-1/read');
      expect(readPaths).toContain('http://localhost:4000/loan-requests/loan-1/read');
    });

    await waitFor(() => {
      expect(screen.queryByText('Belum dibaca')).not.toBeInTheDocument();
    });
  });
});
