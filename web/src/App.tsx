import { useState, type ReactNode } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { SignIn } from './auth/SignIn';
import { useProfile, type Profile } from './auth/useProfile';
import { useSession } from './auth/useSession';
import { PendingBadge, PendingRequestsProvider } from './inventory/InventoryNavigation';
import { supabaseClient } from './lib/supabase';
import { AttendancePage } from './pages/AttendancePage';
import { AdvisorAttendancePage } from './pages/AdvisorAttendancePage';
import { AdminAttendancePage } from './pages/AdminAttendancePage';
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

function Sidebar({
  menuOpen,
  onMenuOpenChange,
  onNavigate,
}: {
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const { profile } = useProfile();
  const location = useLocation();

  const role = profile?.role;
  const navigation = [
    { to: '/jadwal', label: 'Jadwal', children: [] },
    { to: '/reservasi/baru', label: 'Reservasi', children: [] },
    {
      to: '/inventaris',
      label: 'Inventaris',
      children: [
        {
          to: '/inventaris/permintaan-saya',
          label: role === 'admin' ? 'Riwayat permintaan' : 'Permintaan saya',
          roles: ['anggota', 'admin', 'advisor'],
        },
        {
          to: '/inventaris/kotak-masuk',
          label: 'Kotak masuk',
          roles: ['admin', 'advisor'],
          badge: true,
        },
        { to: '/inventaris/baru', label: 'Tambah item', roles: ['admin'] },
      ],
    },
    {
      to: '/monitor',
      roles: ['admin', 'advisor'],
      label: 'Monitoring',
      children: [
        { to: '/monitor/admin', label: 'Kelola kehadiran', roles: ['admin'] },
        { to: '/monitor/rekap', label: 'Rekap per anggota', roles: ['advisor'] },
      ],
    },
    {
      to: '/kehadiran',
      label: 'Kehadiran',
      children: [{ to: '/kehadiran/rekap', label: 'Rekap saya', roles: ['anggota'] }],
    },
    { to: '/laporan-fasilitas', label: 'Laporan', children: [] },
    { to: '/notifikasi', label: 'Notifikasi', children: [] },
  ];
  const roleLabel = role === 'admin' ? 'Admin' : role === 'advisor' ? 'Advisor' : 'Anggota';
  const visibleNavigation = navigation.filter(
    (item) => item.roles === undefined || (role !== undefined && item.roles.includes(role)),
  );

  return (
    <header className="sidebar">
      <div className="sidebar-heading">
        <Link
          className="brand"
          to="/jadwal"
          aria-label="LabManage, buka Jadwal"
          onClick={onNavigate}
        >
          <span className="brand-name">LabManage</span>
          <span className="brand-description">Ruang kerja laboratorium</span>
        </Link>
        <button
          className="nav-toggle"
          type="button"
          aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => onMenuOpenChange(!menuOpen)}
        >
          {menuOpen ? 'Tutup' : 'Menu'}
        </button>
      </div>
      <nav
        id="main-navigation"
        className={`main-navigation${menuOpen ? ' is-open' : ''}`}
        aria-label="Navigasi utama"
      >
        <ul>
          {visibleNavigation.map((item) => {
            const children = item.children.filter((child) => role && child.roles.includes(role));
            return (
              <li className="nav-item" key={item.to}>
                <NavLink to={item.to} className="nav-link" onClick={onNavigate}>
                  {item.label}
                </NavLink>
                {children.length > 0 && (
                  <div className="nav-sublinks">
                    {children.map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        className={`nav-sublink${location.pathname === child.to ? ' active' : ''}`}
                        onClick={onNavigate}
                        aria-current={location.pathname === child.to ? 'location' : undefined}
                      >
                        {child.label}
                        {'badge' in child && child.badge && (
                          <>
                            {' '}
                            <PendingBadge />
                          </>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="account-panel">
        <span className="account-name">{profile?.fullName ?? 'Memuat akun…'}</span>
        <span className="account-role">{role ? roleLabel : 'Peran belum tersedia'}</span>
        <button
          type="button"
          className="logout-button"
          onClick={() => supabaseClient().auth.signOut()}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}

type Role = Profile['role'];

/** Guard route: halaman tidak dirender untuk peran yang tidak berhak, termasuk saat dibuka lewat URL langsung. */
function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile, loading } = useProfile();
  if (loading)
    return (
      <p className="muted" role="status">
        Memuat…
      </p>
    );
  if (!profile || !roles.includes(profile.role)) {
    return (
      <section className="page-state">
        <h1>Halaman tidak tersedia</h1>
        <p className="muted">Halaman ini tidak tersedia untuk peran Anda.</p>
        <Link className="button" to="/jadwal">
          Buka Jadwal
        </Link>
      </section>
    );
  }
  return children;
}

function Shell() {
  const { session, loading } = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(location.pathname);
  const navigationOpen = menuOpen && menuPath === location.pathname;

  if (loading)
    return (
      <main className="app-loading">
        <p className="muted" role="status">
          Memuat…
        </p>
      </main>
    );
  if (!session) return <SignIn />;

  return (
    <PendingRequestsProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Lewati ke konten utama
        </a>
        <Sidebar
          menuOpen={navigationOpen}
          onMenuOpenChange={(open) => {
            setMenuPath(location.pathname);
            setMenuOpen(open);
          }}
          onNavigate={() => setMenuOpen(false)}
        />
        <div className="workspace">
          <main id="main-content" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Navigate to="/jadwal" replace />} />
              <Route path="/jadwal" element={<SchedulePage />} />
              <Route path="/reservasi/baru" element={<NewReservationPage />} />
              <Route path="/inventaris" element={<InventoryPage />} />
              <Route path="/inventaris/permintaan-saya" element={<MyRequestsPage />} />
              <Route path="/inventaris/baru" element={<InventoryNewPage />} />
              <Route path="/inventaris/kotak-masuk" element={<InventoryInboxPage />} />
              <Route path="/inventaris/:id" element={<InventoryItemPage />} />
              <Route
                path="/monitor"
                element={
                  <RoleRoute roles={['admin', 'advisor']}>
                    <MonitorPage key={session.user?.id} />
                  </RoleRoute>
                }
              />
              <Route
                path="/monitor/rekap"
                element={
                  <RoleRoute roles={['advisor']}>
                    <AdvisorAttendancePage key={session.user?.id} />
                  </RoleRoute>
                }
              />
              <Route
                path="/monitor/admin"
                element={
                  <RoleRoute roles={['admin']}>
                    <AdminAttendancePage key={session.user?.id} />
                  </RoleRoute>
                }
              />
              <Route path="/kehadiran" element={<AttendancePage />} />
              <Route
                path="/kehadiran/rekap"
                element={<MyAttendanceSummaryPage key={session.user?.id} />}
              />
              <Route path="/laporan-fasilitas" element={<FacilityReportsPage />} />
              <Route path="/notifikasi" element={<NotificationsPage key={session.user?.id} />} />
              <Route
                path="*"
                element={
                  <section className="page-state">
                    <h1>Halaman tidak ditemukan</h1>
                    <p className="muted">Periksa alamat atau kembali ke jadwal.</p>
                    <Link className="button" to="/jadwal">
                      Buka Jadwal
                    </Link>
                  </section>
                }
              />
            </Routes>
          </main>
        </div>
      </div>
    </PendingRequestsProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
