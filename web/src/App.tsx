import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from './auth/SignIn';
import { useSession } from './auth/useSession';
import { NewReservationPage } from './pages/NewReservationPage';
import { SchedulePage } from './pages/SchedulePage';
import { supabase } from './lib/supabase';

function Shell() {
  const { session, loading } = useSession();

  if (loading) return <main className="app">Memuat…</main>;
  if (!session) return <SignIn />;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">LabManage</span>
        <nav aria-label="Navigasi utama">
          <NavLink to="/jadwal">Jadwal</NavLink>
          <NavLink to="/reservasi/baru">Reservasi</NavLink>
        </nav>
        <button type="button" className="link-back" onClick={() => supabase.auth.signOut()}>
          Keluar
        </button>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/jadwal" replace />} />
          <Route path="/jadwal" element={<SchedulePage />} />
          <Route path="/reservasi/baru" element={<NewReservationPage />} />
          <Route path="*" element={<p className="muted">Halaman tidak ditemukan.</p>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
