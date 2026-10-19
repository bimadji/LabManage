import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay, formatTime } from '../lib/datetime';
import { describeHistory, itemBadge, type BadgeTone } from '../lib/inventory';
import type { HistoryEntry, InventoryItem } from '../types';

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  bad: 'badge badge-bad',
  muted: 'badge',
};

export function InventoryItemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isAdmin = profile?.role === 'admin';

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [absolute, setAbsolute] = useState('');
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<InventoryItem[]>('/inventory'),
      apiFetch<HistoryEntry[]>(`/inventory/${id}/history`),
    ])
      .then(([items, entries]) => {
        if (!active) return;
        const found = items.find((row) => row.id === id) ?? null;
        setItem(found);
        setHistory(entries);
        setStatus(found ? 'ready' : 'missing');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  async function changeQuantity(mode: 'tambah' | 'kurang' | 'set', value: number) {
    setError(null);
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ mode, amount: value }),
      });
      setItem(updated);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Stok gagal diubah. Coba lagi.');
    }
  }

  async function markReturned() {
    setError(null);
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}/return`, {
        method: 'PATCH',
      });
      setItem(updated);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Gagal menandai kembali. Coba lagi.');
    }
  }

  async function saveDetails(input: {
    name: string;
    category: string;
    location: string;
    minStock: number;
  }) {
    setError(null);
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setItem(updated);
      setEditing(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Item gagal diubah. Coba lagi.');
    }
  }

  async function removeItem() {
    if (!item) return;
    if (!window.confirm(`Hapus ${item.name}? Riwayat item ini juga terhapus.`)) return;

    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/inventory/${id}`, { method: 'DELETE' });
      navigate('/inventaris');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Item gagal dihapus. Coba lagi.');
    }
  }

  if (status === 'loading') return <p className="muted">Memuat item…</p>;
  if (status === 'error') {
    return (
      <p className="error" role="alert">
        Item gagal dimuat. Muat ulang halaman.
      </p>
    );
  }
  if (status === 'missing' || !item) {
    return (
      <section>
        <p className="muted">Item tidak ditemukan.</p>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </section>
    );
  }

  const badge = itemBadge(item);
  const change = Number(amount);

  return (
    <section>
      <div className="page-head">
        <h1>{item.name}</h1>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      <div className="card">
        <p className="muted">
          {item.category}
          {item.location ? ` · ${item.location}` : ''} · {item.kind}
        </p>
        {item.kind === 'komponen' ? (
          <p className="reservation-time">
            Stok {item.quantity} · minimum {item.minStock}
          </p>
        ) : (
          <p className="reservation-time">Satu unit</p>
        )}
        <span className={TONE_CLASS[badge.tone]}>{badge.label}</span>
        {item.borrowerName && <p className="muted">Dipinjam oleh {item.borrowerName}</p>}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {isAdmin && item.kind === 'komponen' && (
          <div className="inline-form">
            <label htmlFor="perubahan">Jumlah perubahan</label>
            <input
              id="perubahan"
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <div className="page-head">
              <button
                type="button"
                onClick={() => void changeQuantity('tambah', change)}
                disabled={!Number.isInteger(change) || change < 1}
              >
                + Tambah
              </button>
              <button
                type="button"
                onClick={() => void changeQuantity('kurang', change)}
                disabled={!Number.isInteger(change) || change < 1}
              >
                − Kurang
              </button>
            </div>

            <label htmlFor="angka-pasti">Isi angka pasti</label>
            <input
              id="angka-pasti"
              type="number"
              min={0}
              value={absolute}
              onChange={(event) => setAbsolute(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void changeQuantity('set', Number(absolute))}
              disabled={absolute === '' || !Number.isInteger(Number(absolute))}
            >
              Set
            </button>
          </div>
        )}

        {isAdmin && item.kind === 'barang' && item.status === 'dipinjam' && (
          <button type="button" onClick={() => void markReturned()}>
            Tandai kembali
          </button>
        )}

        {isAdmin && (
          <div className="page-head">
            <button type="button" className="link-back" onClick={() => setEditing((v) => !v)}>
              Ubah item
            </button>
            <button type="button" className="link-back" onClick={() => void removeItem()}>
              Hapus item
            </button>
          </div>
        )}

        {isAdmin && editing && (
          <EditItemForm item={item} onSave={saveDetails} onCancel={() => setEditing(false)} />
        )}
      </div>

      <h2>Riwayat</h2>
      {history.length === 0 && <p className="muted">Belum ada riwayat.</p>}
      <ul className="cards">
        {history.map((entry) => {
          const described = describeHistory(entry);
          return (
            <li key={entry.id} className="card">
              <p className="reservation-room">{described.label}</p>
              <p className="muted">
                {formatDay(entry.createdAt)} {formatTime(entry.createdAt)} WIB ·{' '}
                {entry.actorName ?? 'Tanpa nama'}
              </p>
              {described.change && <p className="reservation-time">{described.change}</p>}
              {entry.note && <p className="muted">{entry.note}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface EditItemFormProps {
  item: InventoryItem;
  onSave: (input: {
    name: string;
    category: string;
    location: string;
    minStock: number;
  }) => Promise<void>;
  onCancel: () => void;
}

function EditItemForm({ item, onSave, onCancel }: EditItemFormProps) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [location, setLocation] = useState(item.location ?? '');
  const [minStock, setMinStock] = useState(String(item.minStock));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      category: category.trim(),
      location: location.trim(),
      minStock: Number(minStock),
    });
  }

  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label htmlFor="ubah-nama">Nama</label>
      <input id="ubah-nama" value={name} onChange={(e) => setName(e.target.value)} required />

      <label htmlFor="ubah-kategori">Kategori</label>
      <input
        id="ubah-kategori"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        required
      />

      <label htmlFor="ubah-lokasi">Lokasi</label>
      <input id="ubah-lokasi" value={location} onChange={(e) => setLocation(e.target.value)} />

      {item.kind === 'komponen' && (
        <>
          <label htmlFor="ubah-min">Stok minimum</label>
          <input
            id="ubah-min"
            type="number"
            min={0}
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </>
      )}

      <button type="submit">Simpan perubahan</button>
      <button type="button" className="link-back" onClick={onCancel}>
        Batal
      </button>
    </form>
  );
}
