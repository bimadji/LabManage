import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';

// App renders the auth gate, which reads a Supabase session.
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  },
}));

describe('App', () => {
  it('menampilkan layar masuk saat belum ada sesi', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'LabManage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
