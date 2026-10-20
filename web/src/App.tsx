import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SignIn } from './auth/SignIn';
import { useProfile } from './auth/useProfile';
import { useSession } from './auth/useSession';
import { apiFetch } from './lib/api';
import { supabaseClient } from './lib/supabase';
import { AttendancePage } from './pages/AttendancePage';
import { FacilityReportsPage } from './pages/FacilityReportsPage';
import { InventoryInboxPage } from './pages/InventoryInboxPage';
import { InventoryItemPage } from './pages/InventoryItemPage';
import { InventoryNewPage } from './pages/InventoryNewPage';
import { InventoryPage } from './pages/InventoryPage';
import { MonitorPage } from './pages/MonitorPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { MyAttendanceSummaryPage } from './pages/MyAttendanceSummaryPage';
import { NewReservationPage } from './pages/NewReservationPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SchedulePage } from './pages/SchedulePage';

/** Admin badge: how many inventory requests still wait for a decision. */
function PendingBadge() {
  const { profile } = useProfile();
  const location = useLocation();
  const [total, setTotal] = useState(0);
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    apiFetch<{ total: number }>('/inventory/pending-count')
      .then((count) => {
        if (active) setTotal(count.total);
      })
      .catch(() => {
        if (active) setTotal(0);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, location.pathname]);

  if (!isAdmin || total === 0) return null;
  return (
    <span className="badge" aria-label={`${total} permintaan menunggu`}>
      {total}
    </span>
  );
}

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
          <NavLink to="/inventaris">
            Inventaris
            <PendingBadge />
          </NavLink>
          <NavLink to="/monitor">Monitoring</NavLink>
          <NavLink to="/kehadiran">Kehadiran</NavLink>
          <NavLink to="/laporan-fasilitas">Laporan</NavLink>
          <NavLink to="/notifikasi">Notifikasi</NavLink>
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
          <Route path="/inventaris/baru" element={<InventoryNewPage />} />
          <Route path="/inventaris/kotak-masuk" element={<InventoryInboxPage />} />
          <Route path="/inventaris/:id" element={<InventoryItemPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/kehadiran" element={<AttendancePage />} />
          <Route
            path="/kehadiran/rekap"
            element={<MyAttendanceSummaryPage key={session.user?.id} />}
          />
          <Route path="/laporan-fasilitas" element={<FacilityReportsPage />} />
          <Route path="/notifikasi" element={<NotificationsPage key={session.user?.id} />} />
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
