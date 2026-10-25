import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryInboxPage } from './InventoryInboxPage';
import type { ComponentRequest, LoanRequest } from '../types';
import type { ProfileState } from '../auth/useProfile';

vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const profileState: ProfileState = {
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
  it('profil tidak tersedia mendapat konteks halaman dan jalur kembali tanpa kontrol keputusan', () => {
    profileState.profile = null;
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Kotak masuk inventaris', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Halaman ini hanya untuk admin dan advisor.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke inventaris' })).toHaveAttribute(
      'href',
      '/inventaris',
    );
    expect(screen.queryByRole('button', { name: 'Konfirmasi' })).not.toBeInTheDocument();
  });

  it('mengumumkan loading dan memulihkan error baca melalui retry', async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat permintaan');
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () => finish(jsonResponse(500, { error: { message: 'gagal' } })));
    await screen.findByRole('alert');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, [])),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Tidak ada laporan.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Laporan ambil' })).toBeInTheDocument();
  });

  it('mengunci keputusan dan filter selama simpan lalu menampilkan hasil', async () => {
    let finish!: (value: Response) => void;
    let row = { ...COMPONENTS[0], adminReadAt: '2026-10-23T00:00:00Z' };
    const writes: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          writes.push(String(url));
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        }
        return Promise.resolve(
          jsonResponse(200, String(url).endsWith('/component-requests') ? [row] : []),
        );
      }),
    );
    renderPage();
    await userEvent.setup().dblClick(await screen.findByRole('button', { name: 'Konfirmasi' }));
    expect(writes).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Menyimpan');
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeDisabled();
    expect(screen.getByLabelText('Jenis permintaan')).toBeDisabled();
    row = { ...row, status: 'dikonfirmasi' };
    await act(async () => finish(jsonResponse(200, row)));
    expect(
      await within(screen.getByRole('list', { name: 'Laporan ambil' })).findByText('DIKONFIRMASI'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Keputusan berhasil disimpan');
    expect(screen.queryByRole('button', { name: 'Konfirmasi' })).not.toBeInTheDocument();
  });

  it('alasan penolakan per kartu memiliki label unik dan tetap ada setelah error', async () => {
    let fail = true;
    let rows = COMPONENTS.map((row) => ({
      ...row,
      status: 'menunggu' as const,
      adminReadAt: '2026-10-23T00:00:00Z',
    }));
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          bodies.push(JSON.parse(String(init.body)));
          if (fail) return jsonResponse(500, { error: { message: 'Penolakan gagal' } });
          rows = rows.filter((row) => !String(url).includes(row.id));
          return jsonResponse(200, {});
        }
        return jsonResponse(200, String(url).endsWith('/component-requests') ? rows : []);
      }),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Resistor 220 Ohm');
    for (const button of screen.getAllByRole('button', { name: 'Tolak' })) await user.click(button);
    const inputs = screen.getAllByLabelText('Alasan (opsional)');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
    await user.type(inputs[0], '  Untuk lomba  ');
    await user.click(screen.getAllByRole('button', { name: 'Kirim penolakan' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Penolakan gagal');
    expect(screen.getAllByLabelText('Alasan (opsional)')[0]).toHaveValue('  Untuk lomba  ');
    fail = false;
    await user.click(screen.getAllByRole('button', { name: 'Kirim penolakan' })[0]);
    expect(await screen.findByText('Keputusan berhasil disimpan.')).toBeInTheDocument();
    expect(bodies).toEqual([{ note: 'Untuk lomba' }, { note: 'Untuk lomba' }]);
  });

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
