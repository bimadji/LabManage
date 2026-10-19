import type { InventoryItem, ItemKind, ItemStatus, RequestStatus, StockFlag } from '../types';

export const STOCK_FLAG_LABEL: Record<StockFlag, string> = {
  habis: 'HABIS',
  menipis: 'MENIPIS',
  aman: 'AMAN',
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  tersedia: 'TERSEDIA',
  dipinjam: 'DIPINJAM',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  menunggu: 'MENUNGGU',
  dikonfirmasi: 'DIKONFIRMASI',
  ditolak: 'DITOLAK',
  disetujui: 'DISETUJUI',
  dibatalkan: 'DIBATALKAN',
};

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'muted';

export interface ItemBadge {
  label: string;
  tone: BadgeTone;
}

const STOCK_TONE: Record<StockFlag, BadgeTone> = { aman: 'ok', menipis: 'warn', habis: 'bad' };
const STATUS_TONE: Record<ItemStatus, BadgeTone> = { tersedia: 'ok', dipinjam: 'warn' };

/** Badge text and tone for one item: stock flag for komponen, loan status for barang. */
export function itemBadge(item: InventoryItem): ItemBadge {
  if (item.kind === 'komponen') {
    const flag = item.stockFlag ?? 'aman';
    return { label: STOCK_FLAG_LABEL[flag], tone: STOCK_TONE[flag] };
  }
  return { label: ITEM_STATUS_LABEL[item.status], tone: STATUS_TONE[item.status] };
}

export interface ItemFilters {
  kind: 'semua' | ItemKind;
  flag: 'semua' | StockFlag | ItemStatus;
  query: string;
}

/** Client-side filter: the inventory list is small, so typing must not hit the API. */
export function filterItems(items: InventoryItem[], filters: ItemFilters): InventoryItem[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.kind !== 'semua' && item.kind !== filters.kind) return false;
    if (filters.flag !== 'semua') {
      if (item.kind === 'komponen' && item.stockFlag !== filters.flag) return false;
      if (item.kind === 'barang' && item.status !== filters.flag) return false;
    }
    if (query !== '' && !item.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

/** Action verbs and quantity/status deltas for the history list. */
export function describeHistory(entry: {
  action: string;
  beforeQty: number | null;
  afterQty: number | null;
  beforeStatus: string | null;
  afterStatus: string | null;
}): { label: string; change: string | null } {
  const labels: Record<string, string> = {
    buat: 'Item dibuat',
    ubah: 'Detail diubah',
    hapus: 'Item dihapus',
    tambah: 'Stok ditambah',
    kurang: 'Stok dikurangi',
    set: 'Stok diisi ulang',
    pinjam: 'Dipinjam',
    kembali: 'Dikembalikan',
    konfirmasi_ambil: 'Ambil dikonfirmasi',
    tolak_ambil: 'Ambil ditolak',
    setujui_pinjam: 'Pinjam disetujui',
    tolak_pinjam: 'Pinjam ditolak',
    batal_pinjam: 'Pinjam dibatalkan',
  };

  let change: string | null = null;
  if (entry.beforeQty !== null && entry.afterQty !== null && entry.beforeQty !== entry.afterQty) {
    change = `${entry.beforeQty} → ${entry.afterQty}`;
  } else if (entry.beforeStatus !== null && entry.afterStatus !== null) {
    change = `${entry.beforeStatus} → ${entry.afterStatus}`;
  }

  return { label: labels[entry.action] ?? entry.action, change };
}
