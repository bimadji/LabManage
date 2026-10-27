export type KelompokType = "tim_riset" | "ukm";

export type UserRole = "admin" | "anggota" | "advisor";

export type ItemStatus = "tersedia" | "dipinjam" | "rusak" | "habis";

export type RequestStatus = "menunggu" | "disetujui" | "ditolak" | "selesai";

export type ItemCategory =
  | "mikrokontroler"
  | "sensor"
  | "actuator"
  | "perkakas"
  | "komponen";

export interface Kelompok {
  id: string;
  nama: string;
  jenis: KelompokType;
  target_jam_mingguan: number | null;
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  nimOrNip: string;
  role: UserRole;
  avatar: string;
  email: string;
  team: string; // Kelompok name
  teamId?: string;
  teamType?: KelompokType;
  weeklyTargetHours: number | null; // null for UKM
}

export interface Item {
  id: string;
  name: string;
  code: string;
  category: ItemCategory;
  categoryLabel: string;
  totalStock: number;
  availableStock: number;
  location: string;
  status: ItemStatus;
  specs: string;
  imageUrl?: string;
  pemilikKelompokId?: string | null;
  pemilikKelompokNama?: string | null;
  dapatDipinjamKelompokLain?: boolean;
}

export interface LoanRequest {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  itemCategory: ItemCategory;
  requesterId: string;
  requesterName: string;
  requesterNim: string;
  requesterAvatar: string;
  requesterKelompokId?: string;
  requesterKelompokNama?: string;
  quantity: number;
  projectPurpose: string;
  requestDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: RequestStatus;
  notes?: string;
  rejectionReason?: string;
}

export interface RoomBooking {
  id: string;
  roomId?: string;
  roomName: string;
  roomCode: string;
  capacity: number;
  date: string;
  timeSlot: string; // e.g. "08:00 - 12:00 WIB (Pagi)"
  startTime?: string;
  endTime?: string;
  picName: string;
  picNim: string;
  userId?: string;
  kelompokId?: string;
  kelompokNama?: string;
  purpose: string;
  participantsCount: number;
  status: "aktif" | "selesai" | "dibatalkan";
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  kelompokId?: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  durationMinutes: number;
  activityNotes?: string;
}

export interface LabReport {
  id: string;
  itemId?: string;
  userId?: string;
  kelompokId?: string;
  type: "habis" | "rusak";
  title: string;
  description: string;
  location: string;
  reporterName: string;
  reporterRole: UserRole;
  createdAt: string;
  urgency: "normal" | "tinggi" | "darurat";
  status: "menunggu" | "ditangani" | "selesai";
  tindakan?: string;
}

export interface MemberMonitoringSummary {
  userId: string;
  name: string;
  nim: string;
  team: string;
  teamType?: KelompokType;
  avatar: string;
  hoursThisWeek: number;
  targetHours: number | null;
  isCurrentlyInLab: boolean;
  lastActive: string;
}
