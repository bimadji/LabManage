import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryPage } from './InventoryPage';
import type { InventoryItem } from '../types';

vi.mock('../lib/supabase', () => ({
  supabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) },
  }),
}));

const profileState = {
  profile: { id: 'user-1', role: 'anggota', fullName: 'Anggota Demo' },
  loading: false,
};
vi.mock('../auth/useProfile', () => ({
  useProfile: () => profileState,
}));

const ITEMS: InventoryItem[] = [
  {
    id: 'item-habis',
    name: 'Baterai LiPo 3S',
    category: 'daya',
    location: 'Lemari C',
    kind: 'komponen',
    quantity: 0,
    minStock: 2,
    stockFlag: 'habis',
    status: 'tersedia',
    borrowedBy: null,
    borrowedAt: null,
    borrowerName: null,
    updatedAt: '2026-10-19T04:00:00Z',
  },
  {
    id: 'item-menipis',
    name: 'Kapasitor 100 uF',
    category: 'komponen pasif',
    location: 'Laci 1',
    kind: 'komponen',
    quantity: 3,
    minStock: 5,
    stockFlag: 'menipis',
    status: 'tersedia',
    borrowedBy: null,
    borrowedAt: null,
    borrowerName: null,
    updatedAt: '2026-10-19T04:00:00Z',
  },
  {
    id: 'item-aman',
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
  },
  {
    id: 'item-dipinjam',
    name: 'Laptop Lenovo ThinkPad E14',
    category: 'komputer',
    location: 'Lemari D',
    kind: 'barang',
    quantity: 1,
    minStock: 0,
    stockFlag: null,
    status: 'dipinjam',
    borrowedBy: 'user-2',
    borrowedAt: '2026-10-19T03:00:00Z',
    borrowerName: 'Anggota Demo',
    updatedAt: '2026-10-19T04:00:00Z',
  },
  {
    id: 'item-tersedia',
    name: 'Osiloskop Rigol DS1054Z',
    category: 'alat ukur',
    location: 'Meja 1',
    kind: 'barang',
    quantity: 1,
    minStock: 0,
    stockFlag: null,
    status: 'tersedia',
    borrowedBy: null,
    borrowedAt: null,
    borrowerName: null,
    updatedAt: '2026-10-19T04:00:00Z',
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
      <InventoryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  profileState.profile = { id: 'user-1', role: 'anggota', fullName: 'Anggota Demo' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith('/inventory')) return jsonResponse(200, ITEMS);
      return jsonResponse(201, { id: 'req-1' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InventoryPage', () => {
  it('mengumumkan pemuatan sebelum menampilkan hasil inventaris', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Memuat inventaris');
    expect(screen.queryByText(/Tidak ada item yang cocok/)).not.toBeInTheDocument();
    await waitFor(() => expect(resolve).toBeDefined());
    resolve(jsonResponse(200, ITEMS));
    expect(await screen.findByText(/Menampilkan 5 dari 5 item/)).toHaveAttribute('role', 'status');
  });

  it('membedakan katalog kosong dari hasil filter kosong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, [])),
    );
    renderPage();

    await screen.findByText('Inventaris belum tersedia.');
    expect(screen.getByText(/Hubungi admin/)).toBeInTheDocument();
    expect(screen.queryByText(/Tidak ada item yang cocok/)).not.toBeInTheDocument();
  });

  it('menghapus semua filter untuk memulihkan daftar tanpa mengambil ulang data', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Resistor 220 Ohm');
    await user.selectOptions(screen.getByLabelText('Jenis'), 'barang');
    await user.selectOptions(screen.getByLabelText('Status'), 'tersedia');
    await user.type(screen.getByLabelText('Cari'), 'tidak cocok');

    expect(screen.getByRole('status')).toHaveTextContent('Menampilkan 0 dari 5 item');
    expect(screen.getByText(/Tidak ada item yang cocok/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hapus filter' }));

    expect(screen.getByLabelText('Cari')).toHaveValue('');
    expect(screen.getByLabelText('Cari')).toHaveFocus();
    expect(screen.getByLabelText('Jenis')).toHaveValue('semua');
    expect(screen.getByLabelText('Status')).toHaveValue('semua');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('Menampilkan 5 dari 5 item');
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/inventory')),
    ).toHaveLength(1);
  });

  it('menampilkan kegagalan pemuatan tanpa pesan katalog kosong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, { error: { code: 'INTERNAL', message: 'Gagal' } })),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Inventaris gagal dimuat');
    expect(screen.queryByText('Inventaris belum tersedia.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Menampilkan/)).not.toBeInTheDocument();
  });

  it('menampilkan badge teks untuk komponen dan barang', async () => {
    renderPage();
    await screen.findByText('Baterai LiPo 3S');

    // Badge hidup di dalam kartu; label filter juga memakai teks yang sama.
    const list = screen.getByRole('list');
    expect(within(list).getByText('HABIS')).toBeInTheDocument();
    expect(within(list).getByText('MENIPIS')).toBeInTheDocument();
    expect(within(list).getByText('AMAN')).toBeInTheDocument();
    expect(within(list).getByText('DIPINJAM')).toBeInTheDocument();
    expect(within(list).getByText('TERSEDIA')).toBeInTheDocument();
    expect(within(list).getByText('Dipinjam oleh Anggota Demo')).toBeInTheDocument();
  });

  it('filter jenis Barang menyembunyikan komponen', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Baterai LiPo 3S');

    await user.selectOptions(screen.getByLabelText('Jenis'), 'barang');

    expect(screen.queryByText('Baterai LiPo 3S')).not.toBeInTheDocument();
    expect(screen.getByText('Osiloskop Rigol DS1054Z')).toBeInTheDocument();
  });

  it('pencarian menyaring berdasarkan nama', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Baterai LiPo 3S');

    await user.type(screen.getByLabelText('Cari'), 'osilo');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Osiloskop Rigol DS1054Z')).toBeInTheDocument();
  });

  it('Lapor ambil mengirim jumlah dan catatan ke API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Resistor 220 Ohm');

    const card = screen.getByText('Resistor 220 Ohm').closest('li') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Lapor ambil' }));
    await user.clear(within(card).getByLabelText('Jumlah'));
    await user.type(within(card).getByLabelText('Jumlah'), '2');
    await user.type(within(card).getByLabelText('Catatan (opsional)'), 'untuk proyek');
    await user.click(within(card).getByRole('button', { name: 'Kirim laporan' }));

    expect(await screen.findByText('Laporan terkirim, menunggu konfirmasi admin.')).toHaveAttribute(
      'role',
      'status',
    );

    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/component-requests'));
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      itemId: 'item-aman',
      qty: 2,
      note: 'untuk proyek',
    });
  });

  it('tidak menawarkan pinjam untuk barang yang sedang dipinjam', async () => {
    renderPage();
    await screen.findByText('Laptop Lenovo ThinkPad E14');

    const dipinjam = screen.getByText('Laptop Lenovo ThinkPad E14').closest('li') as HTMLElement;
    expect(
      within(dipinjam).queryByRole('button', { name: 'Ajukan pinjam' }),
    ).not.toBeInTheDocument();

    const tersedia = screen.getByText('Osiloskop Rigol DS1054Z').closest('li') as HTMLElement;
    expect(within(tersedia).getByRole('button', { name: 'Ajukan pinjam' })).toBeInTheDocument();
  });

  it('mengirim permintaan pinjam dengan payload yang tetap dan mengumumkan keberhasilan', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = (await screen.findByText('Osiloskop Rigol DS1054Z')).closest('li') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Ajukan pinjam' }));
    await user.type(within(card).getByLabelText('Keperluan'), '  Pengujian robot  ');
    await user.type(within(card).getByLabelText('Perkiraan kembali (opsional)'), '2026-10-23');
    await user.click(within(card).getByRole('button', { name: 'Kirim permintaan' }));

    expect(await within(card).findByRole('status')).toHaveTextContent('Permintaan terkirim');
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/loan-requests'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      itemId: 'item-tersedia',
      purpose: 'Pengujian robot',
      expectedReturnAt: '2026-10-23',
    });
  });

  it('admin tetap memiliki tautan pengelolaan dan tombol permintaan', async () => {
    profileState.profile = { id: 'user-admin', role: 'admin', fullName: 'Admin Demo' };
    renderPage();
    await screen.findByText('Resistor 220 Ohm');
    expect(screen.getByRole('link', { name: 'Tambah item' })).toHaveAttribute(
      'href',
      '/inventaris/baru',
    );
    expect(screen.getByRole('link', { name: 'Kotak masuk' })).toHaveAttribute(
      'href',
      '/inventaris/kotak-masuk',
    );
    expect(screen.getByRole('button', { name: 'Ajukan pinjam' })).toBeInTheDocument();
  });

  it('menampilkan pesan error API pada role alert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/inventory')) return jsonResponse(200, ITEMS);
        return jsonResponse(409, {
          error: { code: 'INSUFFICIENT_STOCK', message: 'Stok tidak mencukupi' },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Resistor 220 Ohm');

    const card = screen.getByText('Resistor 220 Ohm').closest('li') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Lapor ambil' }));
    await user.click(within(card).getByRole('button', { name: 'Kirim laporan' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Stok tidak mencukupi');
  });

  it('advisor tidak melihat tombol permintaan', async () => {
    profileState.profile = { id: 'user-3', role: 'advisor', fullName: 'Advisor Demo' };
    renderPage();
    await screen.findByText('Resistor 220 Ohm');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lapor ambil' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Ajukan pinjam' })).not.toBeInTheDocument();
  });
});
