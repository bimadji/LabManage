import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
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

  if (loading) return <p className="muted">Memuat…</p>;
  if (profile?.role !== 'admin') {
    return <p className="muted">Halaman ini hanya untuk admin.</p>;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
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
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>Item inventaris baru</h1>
        <Link className="link-back" to="/inventaris">
          Kembali ke inventaris
        </Link>
      </div>

      <form className="card form" onSubmit={onSubmit} noValidate>
        <label htmlFor="item-nama">Nama</label>
        <input id="item-nama" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="item-kategori">Kategori</label>
        <input
          id="item-kategori"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />

        <label htmlFor="item-jenis">Jenis</label>
        <select id="item-jenis" value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          <option value="komponen">Komponen habis pakai</option>
          <option value="barang">Barang satuan</option>
        </select>

        <label htmlFor="item-lokasi">Lokasi</label>
        <input id="item-lokasi" value={location} onChange={(e) => setLocation(e.target.value)} />

        {kind === 'komponen' && (
          <>
            <label htmlFor="item-jumlah">Jumlah awal</label>
            <input
              id="item-jumlah"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

            <label htmlFor="item-min">Stok minimum</label>
            <input
              id="item-min"
              type="number"
              min={0}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan item'}
        </button>
      </form>
    </section>
  );
}
