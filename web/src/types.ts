export type Role = 'anggota' | 'admin' | 'advisor';

export interface UserNotification {
  id: string;
  kind: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  userId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMinutes: number;
}

export type ReportCategory = 'lampu' | 'ventilasi' | 'kerusakan';
export type ReportStatus = 'baru' | 'ditindaklanjuti' | 'selesai';

export interface FacilityReport {
  id: string;
  category: ReportCategory;
  description: string;
  location: string;
  reportedBy: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  kind: 'ruang' | 'alat';
}

export interface Reservation {
  id: string;
  roomId: string;
  team: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  status: 'aktif' | 'dibatalkan';
  createdAt: string;
}

export type ItemKind = 'komponen' | 'barang';
export type StockFlag = 'habis' | 'menipis' | 'aman';
export type ItemStatus = 'tersedia' | 'dipinjam';
export type RequestStatus = 'menunggu' | 'dikonfirmasi' | 'ditolak' | 'disetujui' | 'dibatalkan';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  location: string | null;
  kind: ItemKind;
  quantity: number;
  minStock: number;
  /** Null for barang: only komponen has a stock flag. */
  stockFlag: StockFlag | null;
  status: ItemStatus;
  borrowedBy: string | null;
  borrowedAt: string | null;
  borrowerName: string | null;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  itemId: string;
  actorId: string;
  actorName: string | null;
  action: string;
  beforeQty: number | null;
  afterQty: number | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface ComponentRequest {
  id: string;
  itemId: string;
  itemName: string | null;
  userId: string;
  requesterName: string | null;
  qty: number;
  note: string | null;
  status: RequestStatus;
  adminNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  adminReadAt: string | null;
  createdAt: string;
}

export interface LoanRequest {
  id: string;
  itemId: string;
  itemName: string | null;
  userId: string;
  requesterName: string | null;
  purpose: string;
  expectedReturnAt: string | null;
  status: RequestStatus;
  adminNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  adminReadAt: string | null;
  createdAt: string;
}
