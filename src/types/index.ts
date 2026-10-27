export type UserRole = "admin" | "anggota" | "advisor";

export type ItemStatus = "tersedia" | "dipinjam" | "rusak";

export type RequestStatus = "menunggu" | "disetujui" | "ditolak";

export type ItemCategory =
  | "mikrokontroler"
  | "sensor"
  | "actuator"
  | "perkakas"
  | "komponen";

export interface User {
  id: string;
  name: string;
  nimOrNip: string;
  role: UserRole;
  avatar: string;
  email: string;
  team: string;
  weeklyTargetHours: number;
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
  roomName: string;
  roomCode: string;
  capacity: number;
  date: string;
  timeSlot: string; // e.g. "08:00 - 12:00 WIB (Pagi)"
  picName: string;
  picNim: string;
  purpose: string;
  participantsCount: number;
  status: "aktif" | "selesai" | "dibatalkan";
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  durationMinutes: number;
  activityNotes?: string;
}

export interface LabReport {
  id: string;
  type: "habis" | "rusak";
  title: string;
  description: string;
  location: string;
  reporterName: string;
  reporterRole: UserRole;
  createdAt: string;
  urgency: "normal" | "tinggi" | "darurat";
  status: "menunggu" | "ditangani" | "selesai";
}

export interface MemberMonitoringSummary {
  userId: string;
  name: string;
  nim: string;
  team: string;
  avatar: string;
  hoursThisWeek: number;
  targetHours: number;
  isCurrentlyInLab: boolean;
  lastActive: string;
}
