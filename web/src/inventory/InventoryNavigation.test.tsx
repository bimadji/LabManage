import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import { InventoryNavigation, PendingBadge, PendingRequestsProvider } from './InventoryNavigation';

const profileState = {
  profile: { id: 'user-1', role: 'anggota', fullName: 'Anggota' },
  loading: false,
};

vi.mock('../auth/useProfile', () => ({ useProfile: () => profileState }));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));

function renderNavigation(path = '/inventaris') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PendingRequestsProvider>
        <InventoryNavigation />
        <PendingBadge />
      </PendingRequestsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  profileState.profile = { id: 'user-1', role: 'anggota', fullName: 'Anggota' };
});

describe('Navigasi inventaris', () => {
  it('hanya menampilkan katalog dan permintaan sendiri untuk anggota', () => {
    renderNavigation('/inventaris/permintaan-saya');

    const navigation = screen.getByRole('navigation', { name: 'Navigasi inventaris' });
    expect(screen.getByRole('link', { name: 'Katalog' })).toHaveAttribute('href', '/inventaris');
    expect(screen.getByRole('link', { name: 'Permintaan saya' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(screen.queryByRole('link', { name: /Kotak masuk/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Riwayat permintaan' })).not.toBeInTheDocument();
    expect(navigation.querySelectorAll('svg')).toHaveLength(2);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('menampilkan inbox dan riwayat admin dengan satu pengambilan badge bersama', async () => {
    profileState.profile = { id: 'admin-1', role: 'admin', fullName: 'Admin' };
    vi.mocked(apiFetch).mockResolvedValue({ total: 3 });
    renderNavigation();

    expect(screen.getByRole('link', { name: 'Katalog' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(screen.getByRole('link', { name: 'Riwayat permintaan' })).toHaveAttribute(
      'href',
      '/inventaris/permintaan-saya',
    );
    expect(
      await screen.findByRole('link', { name: 'Kotak masuk 3 permintaan pending' }),
    ).toHaveAttribute('href', '/inventaris/kotak-masuk');
    await waitFor(() =>
      expect(
        vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/inventory/pending-count'),
      ).toHaveLength(1),
    );
  });

  it('memberi advisor inbox read-only tanpa meminta badge khusus admin', () => {
    profileState.profile = { id: 'advisor-1', role: 'advisor', fullName: 'Advisor' };
    renderNavigation('/inventaris/item-1');

    expect(screen.getByRole('link', { name: 'Katalog' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(screen.getByRole('link', { name: 'Permintaan saya' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kotak masuk' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Riwayat permintaan' })).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
