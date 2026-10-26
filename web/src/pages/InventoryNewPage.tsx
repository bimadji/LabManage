import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { InventoryNavigation } from '../inventory/InventoryNavigation';
import { apiFetch, ApiRequestError } from '../lib/api';
import type { InventoryItem, ItemKind } from '../types';

export function InventoryNewPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<ItemKind>('komponen');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  if (loading)
    return (
      <p className="muted" role="status">
        Memuat…
      </p>
    );
  if (profile?.role !== 'admin') {
    return (
      <section className="inventory-new-page">
        <div className="page-head">
          <div>
            <h1>Item inventaris baru</h1>
            <p className="muted">Halaman ini hanya untuk admin.</p>
          </div>
          <InventoryNavigation />
        </div>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<InventoryItem>('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          kind,
          location: location.trim() === '' ? undefined : location.trim(),
          quantity: kind === 'komponen' ? Number(quantity) : undefined,
          minStock: kind === 'komponen' ? Number(minStock) : undefined,
        }),
      });
      navigate('/inventaris');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Item gagal disimpan. Coba lagi.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="inventory-new-page">
      <div className="page-head">
        <div>
          <h1>Item inventaris baru</h1>
          <p className="muted">Tambahkan komponen habis pakai atau barang satuan ke katalog lab.</p>
        </div>
      </div>
      <InventoryNavigation />

      <form className="card inventory-new-form" onSubmit={onSubmit} noValidate>
        <div className="inventory-new-sections">
          <fieldset disabled={submitting}>
            <legend>Informasi item</legend>
            <div className="inventory-new-fields">
              <div className="inventory-new-field">
                <label htmlFor="item-nama">Nama</label>
                <input
                  id="item-nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="inventory-new-field">
                <label htmlFor="item-kategori">Kategori</label>
                <input
                  id="item-kategori"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div className="inventory-new-field">
                <label htmlFor="item-lokasi">Lokasi</label>
                <input
                  id="item-lokasi"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  aria-describedby="item-location-hint"
                />
                <p id="item-location-hint" className="muted">
                  Opsional. Contoh: Lemari A atau Laci 1.
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset disabled={submitting}>
            <legend>Jenis dan stok</legend>
            <div className="inventory-new-fields">
              <div className="inventory-new-field">
                <label htmlFor="item-jenis">Jenis</label>
                <select
                  id="item-jenis"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ItemKind)}
                  aria-describedby="item-kind-hint"
                >
                  <option value="komponen">Komponen habis pakai</option>
                  <option value="barang">Barang satuan</option>
                </select>
                <p id="item-kind-hint" className="muted">
                  {kind === 'komponen'
                    ? 'Komponen habis pakai dicatat berdasarkan jumlah stok.'
                    : 'Barang satuan dicatat sebagai satu unit untuk dipinjam dan dikembalikan.'}
                </p>
              </div>
              {kind === 'komponen' && (
                <>
                  <div className="inventory-new-field">
                    <label htmlFor="item-jumlah">Jumlah awal</label>
                    <input
                      id="item-jumlah"
                      type="number"
                      min={0}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="inventory-new-field">
                    <label htmlFor="item-min">Stok minimum</label>
                    <input
                      id="item-min"
                      type="number"
                      min={0}
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </fieldset>
        </div>

        {error && (
          <p className="error inventory-new-message" role="alert">
            {error}
          </p>
        )}

        {submitting && (
          <p className="muted inventory-new-message" role="status">
            Menyimpan item…
          </p>
        )}
        <div className="inventory-new-submit">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan item'}
          </button>
        </div>
      </form>
    </section>
  );
}
