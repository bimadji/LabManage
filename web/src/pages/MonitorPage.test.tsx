import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import { MonitorPage } from './MonitorPage';

vi.mock('../auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'admin-1', role: 'admin', fullName: 'Admin' },
    loading: false,
  }),
}));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../lib/supabase', () => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    supabaseClient: () => ({ channel: vi.fn(() => channel), removeChannel: vi.fn() }),
  };
});

afterEach(() => vi.clearAllMocks());

describe('Monitoring lab', () => {
  it('member list has an accessible name and member names remain headings', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      {
        id: 'session-1',
        userId: 'member-1',
        fullName: 'Bima',
        checkedInAt: '2026-10-25T01:00:00Z',
        durationMinutes: 90,
        overNightLimit: false,
      },
    ] as never);

    render(
      <MemoryRouter>
        <MonitorPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('list', { name: 'Anggota yang sedang di lab' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Bima' })).toBeInTheDocument();
  });
});
