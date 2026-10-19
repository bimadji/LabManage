import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyRequestsPage } from './MyRequestsPage';
import type { ComponentRequest, LoanRequest } from '../types';

vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const COMPONENT_REQUESTS: ComponentRequest[] = [
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

const LOAN_REQUESTS: LoanRequest[] = [
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
  {
    id: 'loan-2',
    itemId: 'item-4',
    itemName: 'Multimeter Fluke 17B+',
    userId: 'user-1',
    requesterName: 'Anggota Demo',
    purpose: 'mengukur rangkaian daya',
    expectedReturnAt: null,
    status: 'ditolak',
    adminNote: 'dipakai lomba',
    decidedBy: 'admin-1',
    decidedAt: '2026-10-19T05:10:00Z',
    adminReadAt: '2026-10-19T05:10:00Z',
    createdAt: '2026-10-19T04:20:00Z',
  },
  {
    id: 'loan-3',
    itemId: 'item-5',
    itemName: 'Laptop Lenovo ThinkPad E14',
    userId: 'user-1',
    requesterName: 'Anggota Demo',
    purpose: 'mengerjakan laporan praktikum',
    expectedReturnAt: null,
    status: 'disetujui',
    adminNote: null,
    decidedBy: 'admin-1',
    decidedAt: '2026-10-19T05:20:00Z',
    adminReadAt: '2026-10-19T05:20:00Z',
    createdAt: '2026-10-19T04:40:00Z',
  },
];

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
      <MyRequestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/component-requests')) return jsonResponse(200, COMPONENT_REQUESTS);
      if (String(url).endsWith('/loan-requests') && init?.method === 'PATCH') {
        return jsonResponse(200, { ...LOAN_REQUESTS[0], status: 'dibatalkan' });
      }
      return jsonResponse(200, LOAN_REQUESTS);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MyRequestsPage', () => {
  it('menampilkan status dan catatan admin sebagai teks', async () => {
    renderPage();
    await screen.findByText('Resistor 220 Ohm');

    const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

    expect(within(card('Resistor 220 Ohm')).getByText('MENUNGGU')).toBeInTheDocument();
    expect(within(card('Kabel Jumper')).getByText('DIKONFIRMASI')).toBeInTheDocument();
    expect(within(card('Osiloskop Rigol DS1054Z')).getByText('MENUNGGU')).toBeInTheDocument();
    expect(within(card('Laptop Lenovo ThinkPad E14')).getByText('DISETUJUI')).toBeInTheDocument();
    expect(within(card('Multimeter Fluke 17B+')).getByText('DITOLAK')).toBeInTheDocument();
    expect(
      within(card('Multimeter Fluke 17B+')).getByText('Catatan admin: dipakai lomba'),
    ).toBeInTheDocument();
    expect(
      within(card('Osiloskop Rigol DS1054Z')).getByText('kalibrasi sensor'),
    ).toBeInTheDocument();
  });

  it('tombol Batalkan hanya muncul untuk permintaan pinjam yang menunggu', async () => {
    renderPage();
    await screen.findByText('Osiloskop Rigol DS1054Z');

    const buttons = screen.getAllByRole('button', { name: 'Batalkan' });
    expect(buttons).toHaveLength(1);

    const pending = screen.getByText('Osiloskop Rigol DS1054Z').closest('li') as HTMLElement;
    expect(buttons[0]).toBe(pending.querySelector('button'));
  });

  it('Batalkan memanggil endpoint cancel lalu memuat ulang daftar', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Osiloskop Rigol DS1054Z');

    await user.click(screen.getByRole('button', { name: 'Batalkan' }));

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain('/loan-requests/loan-1/cancel');
    });

    await waitFor(() => {
      const gets = vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).endsWith('/loan-requests'));
      expect(gets.length).toBeGreaterThan(1);
    });
  });

  it('menampilkan empty state saat belum ada permintaan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, [])),
    );

    renderPage();

    expect(await screen.findByText('Belum ada laporan.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada permintaan.')).toBeInTheDocument();
  });
});
