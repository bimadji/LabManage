import { render, screen, waitFor } from '@testing-library/react';
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
