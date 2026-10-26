import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { InventoryNavigation } from '../inventory/InventoryNavigation';
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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const editToggle = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);

  useEffect(() => {
    if (!editing && !saving && restoreEditFocus.current) {
      editToggle.current?.focus();
      restoreEditFocus.current = false;
    }
  }, [editing, saving]);

  function beginSave() {
    if (pending.current) return false;
    pending.current = true;
    setSaving(true);
    setNotice(null);
    setError(null);
    return true;
  }
  function finishSave() {
    pending.current = false;
    setSaving(false);
  }
  function closeEdit() {
    restoreEditFocus.current = true;
    setEditing(false);
  }

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
    if (!beginSave()) return;
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ mode, amount: value }),
      });
      setItem(updated);
      setReloadKey((key) => key + 1);
      setNotice('Stok berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Stok gagal diubah. Coba lagi.');
    } finally {
      finishSave();
    }
  }

  async function markReturned() {
    if (!beginSave()) return;
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}/return`, {
        method: 'PATCH',
      });
      setItem(updated);
      setReloadKey((key) => key + 1);
      setNotice('Barang berhasil ditandai kembali.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Gagal menandai kembali. Coba lagi.');
    } finally {
      finishSave();
    }
  }

  async function saveDetails(input: {
    name: string;
    category: string;
    location: string;
    minStock: number;
  }) {
    if (!beginSave()) return;
    try {
      const updated = await apiFetch<InventoryItem>(`/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setItem(updated);
      closeEdit();
      setReloadKey((key) => key + 1);
      setNotice('Detail item berhasil disimpan.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Item gagal diubah. Coba lagi.');
    } finally {
      finishSave();
    }
  }

  async function removeItem() {
    if (!item || pending.current) return;
    if (!window.confirm(`Hapus ${item.name}? Riwayat item ini juga terhapus.`)) return;

    if (!beginSave()) return;
    try {
      await apiFetch<{ ok: true }>(`/inventory/${id}`, { method: 'DELETE' });
      navigate('/inventaris');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Item gagal dihapus. Coba lagi.');
    } finally {
      finishSave();
    }
  }

  if (status === 'loading')
    return (
      <section className="inventory-detail-page">
        <InventoryNavigation />
        <p className="muted" role="status">
          Memuat item…
        </p>
      </section>
    );
  if (status === 'error') {
    return (
      <section className="inventory-detail-page">
        <InventoryNavigation />
        <div className="card card-alert">
          <p className="error" role="alert">
            Item gagal dimuat. Coba muat kembali.
          </p>
          <div className="inventory-detail-actions">
            <button
              type="button"
              onClick={() => {
                setStatus('loading');
                setReloadKey((key) => key + 1);
              }}
            >
              Coba lagi
            </button>
            <Link className="link-back" to="/inventaris">
              Kembali ke inventaris
            </Link>
          </div>
        </div>
      </section>
    );
  }
  if (status === 'missing' || !item) {
    return (
      <section className="inventory-detail-page">
        <InventoryNavigation />
        <div className="card card-empty">
          <p className="muted">Item tidak ditemukan.</p>
        </div>
      </section>
    );
  }

  const badge = itemBadge(item);
  const change = Number(amount);

  return (
    <section className="inventory-detail-page">
      <InventoryNavigation />
      <div className="page-head">
        <h1>{item.name}</h1>
      </div>

      <div className="inventory-detail-layout">
        <div className="card inventory-detail-info">
          <h2>Informasi item</h2>
          <p className="muted">Kategori: {item.category}</p>
          <p className="muted">Lokasi: {item.location || 'Belum diisi'}</p>
          <p className="muted">Jenis: {item.kind}</p>
          {item.kind === 'komponen' ? (
            <p className="reservation-time">
              Stok {item.quantity} · minimum {item.minStock}
            </p>
          ) : (
            <p className="reservation-time">Satu unit</p>
          )}
          <span className={TONE_CLASS[badge.tone]}>{badge.label}</span>
          {item.borrowerName && <p className="muted">Dipinjam oleh {item.borrowerName}</p>}
        </div>

        {isAdmin && (
          <div className="card inventory-detail-admin">
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {saving && <p role="status">Menyimpan perubahan…</p>}
            {notice && <p role="status">{notice}</p>}
            <fieldset disabled={saving}>
              <legend>Kelola item</legend>

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
                <div className="inventory-detail-actions">
                  <button
                    ref={editToggle}
                    type="button"
                    className="btn-ghost inventory-edit-toggle"
                    aria-expanded={editing}
                    aria-controls="inventory-edit-form"
                    onClick={() => setEditing((v) => !v)}
                  >
                    Ubah item
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost-danger inventory-delete"
                    onClick={() => void removeItem()}
                  >
                    Hapus item
                  </button>
                </div>
              )}

              {isAdmin && editing && (
                <EditItemForm item={item} onSave={saveDetails} onCancel={closeEdit} />
              )}
            </fieldset>
          </div>
        )}
      </div>

      <section className="inventory-detail-history" aria-labelledby="item-history-heading">
        <h2 id="item-history-heading">Riwayat</h2>
        {history.length === 0 && <p className="card card-empty muted">Belum ada riwayat.</p>}
        <ul className="cards" aria-label="Riwayat perubahan item">
          {history.map((entry) => {
            const described = describeHistory(entry);
            return (
              <li key={entry.id} className="card">
                <p className="reservation-room">{described.label}</p>
                <p className="muted">
                  <time dateTime={entry.createdAt}>
                    {formatDay(entry.createdAt)} {formatTime(entry.createdAt)} WIB
                  </time>{' '}
                  · {entry.actorName ?? 'Tanpa nama'}
                </p>
                {described.change && <p className="reservation-time">{described.change}</p>}
                {entry.note && <p className="muted">{entry.note}</p>}
              </li>
            );
          })}
        </ul>
      </section>
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
    <form
      id="inventory-edit-form"
      className="inline-form inventory-detail-edit"
      onSubmit={onSubmit}
      noValidate
    >
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
      <button type="button" className="btn-ghost" onClick={onCancel}>
        Batal
      </button>
    </form>
  );
}
