import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
      <InventoryNewPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
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

    expect(screen.getByText('Halaman ini hanya untuk admin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan item' })).not.toBeInTheDocument();
  });
});
