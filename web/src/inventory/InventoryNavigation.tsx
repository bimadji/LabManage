import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch } from '../lib/api';
import type { Role } from '../types';

const PendingRequestsContext = createContext(0);

export function PendingRequestsProvider({ children }: { children: ReactNode }) {
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

  return (
    <PendingRequestsContext.Provider value={total}>{children}</PendingRequestsContext.Provider>
  );
}

/** Jumlah permintaan menunggu untuk admin; sumber yang sama dipakai rail dan subnav. */
export function PendingBadge() {
  const { profile } = useProfile();
  const total = useContext(PendingRequestsContext);
  if (profile?.role !== 'admin' || total === 0) return null;
  return (
    <span className="badge nav-badge">
      {total} <span className="sr-only">permintaan pending</span>
    </span>
  );
}

type IconName = 'catalog' | 'inbox' | 'requests';

function InventoryIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'catalog' && (
        <>
          <path d="M4 5.5h6v13H4zM14 5.5h6v13h-6zM10 8.5h4M10 15.5h4" />
        </>
      )}
      {name === 'inbox' && (
        <>
          <path d="M4 5h16v14H4zM4 14h4l2 3h4l2-3h4" />
        </>
      )}
      {name === 'requests' && (
        <>
          <path d="M8 5h11v15H8zM5 18H4V4h11v1M11 10h5M11 14h5" />
        </>
      )}
    </svg>
  );
}

const links: { to: string; label: string; icon: IconName; roles: Role[]; badge?: boolean }[] = [
  { to: '/inventaris', label: 'Katalog', icon: 'catalog', roles: ['anggota', 'advisor', 'admin'] },
  {
    to: '/inventaris/kotak-masuk',
    label: 'Kotak masuk',
    icon: 'inbox',
    roles: ['admin'],
    badge: true,
  },
  {
    to: '/inventaris/permintaan-saya',
    label: 'Riwayat permintaan',
    icon: 'requests',
    roles: ['admin'],
  },
  {
    to: '/inventaris/permintaan-saya',
    label: 'Permintaan saya',
    icon: 'requests',
    roles: ['anggota', 'advisor'],
  },
  {
    to: '/inventaris/kotak-masuk',
    label: 'Kotak masuk',
    icon: 'inbox',
    roles: ['advisor'],
    badge: true,
  },
];

export function InventoryNavigation() {
  const { profile } = useProfile();
  const { pathname } = useLocation();
  if (!profile) return null;

  return (
    <nav className="inventory-subnav" aria-label="Navigasi inventaris">
      <ul className="inventory-subnav-list">
        {links
          .filter((link) => link.roles.includes(profile.role))
          .map((link) => {
            const active =
              link.to === '/inventaris'
                ? pathname === '/inventaris' ||
                  (pathname.startsWith('/inventaris/') &&
                    pathname !== '/inventaris/permintaan-saya' &&
                    pathname !== '/inventaris/kotak-masuk')
                : pathname === link.to;
            return (
              <li key={`${profile.role}:${link.label}`}>
                <Link
                  className="inventory-subnav-link"
                  to={link.to}
                  aria-current={active ? 'location' : undefined}
                >
                  <InventoryIcon name={link.icon} />
                  <span>{link.label}</span>
                  {link.badge && (
                    <>
                      {' '}
                      <PendingBadge />
                    </>
                  )}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
