import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryItemPage } from './InventoryItemPage';
import type { HistoryEntry, InventoryItem } from '../types';

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

const ITEM: InventoryItem = {
  id: 'item-1',
  name: 'Resistor 220 Ohm',
  category: 'komponen pasif',
  location: 'Laci 1',
  kind: 'komponen',
  quantity: 40,
  minStock: 20,
  stockFlag: 'aman',
  status: 'tersedia',
  borrowedBy: null,
  borrowedAt: null,
  borrowerName: null,
  updatedAt: '2026-10-19T04:00:00Z',
};

const HISTORY: HistoryEntry[] = [
  {
    id: 'hist-1',
    itemId: 'item-1',
    actorId: 'admin-1',
    actorName: 'Admin Demo',
    action: 'tambah',
    beforeQty: 35,
    afterQty: 40,
    beforeStatus: null,
    afterStatus: null,
    note: 'restok',
    createdAt: '2026-10-19T04:00:00Z',
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
    <MemoryRouter initialEntries={['/inventaris/item-1']}>
      <Routes>
        <Route path="/inventaris/:id" element={<InventoryItemPage />} />
        <Route path="/inventaris" element={<p>Daftar inventaris</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Demo' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url);
      if (path.endsWith('/history')) return jsonResponse(200, HISTORY);
      if (path.endsWith('/inventory')) return jsonResponse(200, [ITEM]);
      return jsonResponse(200, ITEM);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InventoryItemPage', () => {
  it('mengumumkan loading dan menyediakan pemulihan error baca', async () => {
    let finish!: (response: Response) => void;
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
    expect(screen.getByRole('status')).toHaveTextContent('Memuat item');
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () => finish(jsonResponse(500, { error: { message: 'gagal' } })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Item gagal dimuat');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        jsonResponse(200, String(url).endsWith('/history') ? HISTORY : [ITEM]),
      ),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('heading', { level: 1, name: ITEM.name })).toBeInTheDocument();
  });

  it('memisahkan informasi, kontrol admin, dan riwayat bernama', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: ITEM.name });
    expect(screen.getByRole('heading', { name: 'Informasi item' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kelola item' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Riwayat perubahan item' })).toBeInTheDocument();
  });

  it('mengunci aksi selama simpan, tidak mengirim ganda, dan mengumumkan sukses', async () => {
    let finish!: (response: Response) => void;
    let currentItem = ITEM;
    const writes: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          writes.push(init);
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        }
        return Promise.resolve(
          jsonResponse(200, String(url).endsWith('/history') ? HISTORY : [currentItem]),
        );
      }),
    );
    renderPage();
    await screen.findByRole('heading', { level: 1, name: ITEM.name });
    await userEvent.setup().dblClick(screen.getByRole('button', { name: '+ Tambah' }));
    expect(writes).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Menyimpan');
    expect(screen.getByRole('button', { name: 'Hapus item' })).toBeDisabled();
    expect(screen.getByLabelText('Jumlah perubahan')).toBeDisabled();
    currentItem = { ...ITEM, quantity: 41 };
    await act(async () => finish(jsonResponse(200, currentItem)));
    expect(await screen.findByRole('status')).toHaveTextContent('Stok berhasil diperbarui');
    expect(screen.getByText('Stok 41 · minimum 20')).toBeInTheDocument();
  });

  it('gagal menyimpan mempertahankan form, retry menjaga payload, fokus kembali ke tombol ubah', async () => {
    let fail = true;
    let currentItem = ITEM;
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          bodies.push(JSON.parse(String(init.body)));
          if (fail) return jsonResponse(500, { error: { message: 'Detail gagal disimpan' } });
          currentItem = { ...ITEM, name: 'Baru' };
          return jsonResponse(200, currentItem);
        }
        return jsonResponse(200, String(url).endsWith('/history') ? HISTORY : [currentItem]);
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 1, name: ITEM.name });
    await user.click(screen.getByRole('button', { name: 'Ubah item' }));
    await user.clear(screen.getByLabelText('Nama'));
    await user.type(screen.getByLabelText('Nama'), '  Baru  ');
    await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Detail gagal disimpan');
    expect(screen.getByLabelText('Nama')).toHaveValue('  Baru  ');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    await screen.findByText('Detail item berhasil disimpan.');
    expect(screen.getByRole('heading', { level: 1, name: 'Baru' })).toBeInTheDocument();
    expect(bodies).toEqual(
      Array(2).fill({
        name: 'Baru',
        category: ITEM.category,
        location: ITEM.location,
        minStock: 20,
      }),
    );
    expect(screen.getByRole('button', { name: 'Ubah item' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Ubah item' }));
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('button', { name: 'Ubah item' })).toHaveFocus();
  });

  it('barang dipinjam tetap memakai endpoint kembali dan menampilkan konfirmasi', async () => {
    let borrowed: InventoryItem = {
      ...ITEM,
      kind: 'barang',
      stockFlag: null,
      status: 'dipinjam',
      borrowerName: 'Anggota',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          borrowed = { ...borrowed, status: 'tersedia', borrowerName: null };
          return jsonResponse(200, borrowed);
        }
        return jsonResponse(200, String(url).endsWith('/history') ? [] : [borrowed]);
      }),
    );
    renderPage();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Tandai kembali' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Barang berhasil ditandai kembali');
    expect(screen.getByText('TERSEDIA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai kembali' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dipinjam oleh Anggota')).not.toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/inventory/item-1/return') && init?.method === 'PATCH',
        ),
    ).toBe(true);
  });

  it('advisor melihat riwayat kosong tanpa kontrol admin', async () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        jsonResponse(200, String(url).endsWith('/history') ? [] : [ITEM]),
      ),
    );
    renderPage();
    expect(await screen.findByText('Belum ada riwayat.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Kelola item' })).not.toBeInTheDocument();
  });
  it('menampilkan detail dan riwayat perubahan', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Resistor 220 Ohm' });
    expect(screen.getByText('Stok 40 · minimum 20')).toBeInTheDocument();
    expect(screen.getByText('Stok ditambah')).toBeInTheDocument();
    expect(screen.getByText('35 → 40')).toBeInTheDocument();
    expect(screen.getByText('restok')).toBeInTheDocument();
  });

  it('+ mengirim mode tambah dengan jumlah perubahan', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Resistor 220 Ohm' });

    await user.clear(screen.getByLabelText('Jumlah perubahan'));
    await user.type(screen.getByLabelText('Jumlah perubahan'), '5');
    await user.click(screen.getByRole('button', { name: '+ Tambah' }));

    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(
          ([url, init]) => String(url).endsWith('/quantity') && init?.method === 'PATCH',
        );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ mode: 'tambah', amount: 5 });
    });
  });

  it('membatalkan dialog konfirmasi tidak menghapus item', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Resistor 220 Ohm' });

    await user.click(screen.getByRole('button', { name: 'Hapus item' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Hapus Resistor 220 Ohm? Riwayat item ini juga terhapus.',
    );
    const deletes = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(deletes).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Resistor 220 Ohm' })).toBeInTheDocument();
  });

  it('anggota tidak melihat kontrol tulis', async () => {
    profileState.profile = { id: 'user-1', role: 'anggota', fullName: 'Anggota Demo' };
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Resistor 220 Ohm' });
    expect(screen.queryByRole('button', { name: '+ Tambah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah item' })).not.toBeInTheDocument();
  });
});
