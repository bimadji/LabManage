import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SignIn } from './auth/SignIn';
import { useSession } from './auth/useSession';
import { InventoryPage } from './pages/InventoryPage';
import { MonitorPage } from './pages/MonitorPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { NewReservationPage } from './pages/NewReservationPage';
import { SchedulePage } from './pages/SchedulePage';
import { supabaseClient } from './lib/supabase';

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
          <NavLink to="/inventaris">Inventaris</NavLink>
          <NavLink to="/monitor">Monitoring</NavLink>
        </nav>
        <button type="button" className="link-back" onClick={() => supabaseClient().auth.signOut()}>
          Keluar
        </button>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/jadwal" replace />} />
          <Route path="/jadwal" element={<SchedulePage />} />
          <Route path="/reservasi/baru" element={<NewReservationPage />} />
          <Route path="/inventaris" element={<InventoryPage />} />
          <Route path="/inventaris/permintaan-saya" element={<MyRequestsPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
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
