import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryNewPage } from './InventoryNewPage';

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

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inventaris/baru']}>
      <Routes>
        <Route path="/inventaris/baru" element={<InventoryNewPage />} />
        <Route path="/inventaris" element={<p>Katalog inventaris</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  profileState.loading = false;
  profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin Demo' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(201, { id: 'item-1' })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InventoryNewPage', () => {
  it('mengumumkan pemuatan profil tanpa menampilkan form', () => {
    profileState.loading = true;
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat');
    expect(screen.queryByRole('button', { name: 'Simpan item' })).not.toBeInTheDocument();
  });

  it('mengelompokkan informasi dan stok dengan bantuan isian yang terhubung', async () => {
    renderPage();
    expect(screen.getByRole('group', { name: 'Informasi item' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Jenis dan stok' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lokasi')).toHaveAccessibleDescription(
      'Opsional. Contoh: Lemari A atau Laci 1.',
    );
    expect(screen.getByLabelText('Jenis')).toHaveAccessibleDescription(
      'Komponen habis pakai dicatat berdasarkan jumlah stok.',
    );
    await userEvent.setup().selectOptions(screen.getByLabelText('Jenis'), 'barang');
    expect(screen.getByLabelText('Jenis')).toHaveAccessibleDescription(
      'Barang satuan dicatat sebagai satu unit untuk dipinjam dan dikembalikan.',
    );
  });

  it('mengunci semua isian selama simpan dan mencegah pengiriman ganda', async () => {
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
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nama'), 'Sensor');
    await user.type(screen.getByLabelText('Kategori'), 'Elektronik');
    await user.dblClick(screen.getByRole('button', { name: 'Simpan item' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Menyimpan item');
    for (const label of ['Nama', 'Kategori', 'Lokasi', 'Jenis', 'Jumlah awal', 'Stok minimum']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    await act(async () => finish(jsonResponse(201, { id: 'item-1' })));
    expect(await screen.findByText('Katalog inventaris')).toBeInTheDocument();
  });

  it('mempertahankan isian setelah error dan retry mengirim payload barang yang sama', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fail
          ? jsonResponse(409, { error: { message: 'Nama sudah digunakan' } })
          : jsonResponse(201, { id: 'item-1' }),
      ),
    );
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nama'), '  Multimeter  ');
    await user.type(screen.getByLabelText('Kategori'), '  Alat  ');
    await user.selectOptions(screen.getByLabelText('Jenis'), 'barang');
    await user.click(screen.getByRole('button', { name: 'Simpan item' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nama sudah digunakan');
    expect(screen.getByLabelText('Nama')).toHaveValue('  Multimeter  ');
    expect(screen.getByLabelText('Jenis')).toHaveValue('barang');
    expect(screen.getByLabelText('Kategori')).toBeEnabled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Simpan item' }));
    expect(await screen.findByText('Katalog inventaris')).toBeInTheDocument();
    const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual(Array(2).fill({ name: 'Multimeter', category: 'Alat', kind: 'barang' }));
  });

  it('advisor tidak melihat form dan dapat kembali ke inventaris', () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
    renderPage();
    expect(screen.queryByRole('button', { name: 'Simpan item' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke inventaris' })).toHaveAttribute(
      'href',
      '/inventaris',
    );
  });

  it('mengirim komponen dengan jumlah dan min stok', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Nama'), 'Sensor Api');
    await user.type(screen.getByLabelText('Kategori'), 'sensor');
    await user.type(screen.getByLabelText('Lokasi'), 'Lemari E');
    await user.clear(screen.getByLabelText('Jumlah awal'));
    await user.type(screen.getByLabelText('Jumlah awal'), '12');
    await user.clear(screen.getByLabelText('Stok minimum'));
    await user.type(screen.getByLabelText('Stok minimum'), '4');
    await user.click(screen.getByRole('button', { name: 'Simpan item' }));

    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/inventory'));
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: 'Sensor Api',
        category: 'sensor',
        kind: 'komponen',
        location: 'Lemari E',
        quantity: 12,
        minStock: 4,
      });
    });
  });

  it('menyembunyikan jumlah dan min stok saat jenis barang dipilih', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByLabelText('Jumlah awal')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Jenis'), 'barang');

    expect(screen.queryByLabelText('Jumlah awal')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stok minimum')).not.toBeInTheDocument();
  });

  it('menampilkan pesan khusus untuk non-admin tanpa form', () => {
    profileState.profile = { id: 'user-1', role: 'anggota', fullName: 'Anggota Demo' };
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Item inventaris baru', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Halaman ini hanya untuk admin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan item' })).not.toBeInTheDocument();
  });
});
