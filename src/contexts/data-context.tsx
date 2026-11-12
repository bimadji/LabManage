"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  AttendanceSession,
  Item,
  Kelompok,
  LabReport,
  LoanRequest,
  RoomBooking,
  UserRole,
} from "@/types";
import {
  MOCK_ITEMS,
  MOCK_KELOMPOK,
  MOCK_LAB_REPORTS,
  MOCK_LOAN_REQUESTS,
  MOCK_ROOM_BOOKINGS,
} from "@/lib/mock-data";
import { DEMO_MODE } from "@/lib/demo";
import { overlaps } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/contexts/role-context";

export type ActionResult = { success: boolean; error?: string };

type LoanActionStatus = "disetujui" | "ditolak" | "selesai";
type ReportActionStatus = "ditangani" | "selesai";

interface DataContextType {
  items: Item[];
  loanRequests: LoanRequest[];
  roomBookings: RoomBooking[];
  labReports: LabReport[];
  attendanceSessions: AttendanceSession[];
  kelompok: Kelompok[];
  isLoading: boolean;
  loadError: string | null;
  addInventoryItem: (item: Omit<Item, "id">) => Promise<ActionResult>;
  addStockToItem: (itemId: string, quantity: number) => Promise<ActionResult>;
  addLoanRequest: (req: Omit<LoanRequest, "id" | "requestDate" | "status">) => Promise<ActionResult>;
  updateLoanRequestStatus: (id: string, status: LoanActionStatus, note?: string) => Promise<ActionResult>;
  addRoomBooking: (booking: Omit<RoomBooking, "id" | "status">) => Promise<ActionResult>;
  addLabReport: (report: Omit<LabReport, "id" | "createdAt" | "status">) => Promise<ActionResult>;
  updateReportStatus: (id: string, status: ReportActionStatus) => Promise<ActionResult>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

type Row = Record<string, unknown>;

function formatTanggal(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatJam(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapItem(row: Row): Item {
  const kategori = String(row.kategori ?? "");
  const kelompok = (row.kelompok as Row | null)?.nama;
  return {
    id: String(row.id ?? ""),
    name: String(row.nama ?? ""),
    code: String(row.kode ?? ""),
    category: kategori as Item["category"],
    categoryLabel: kategori ? kategori.charAt(0).toUpperCase() + kategori.slice(1) : "",
    totalStock: Number(row.stok_total ?? 0),
    availableStock: Number(row.stok_tersedia ?? 0),
    location: String(row.lokasi ?? ""),
    status: String(row.status ?? "") as Item["status"],
    specs: String(row.spesifikasi ?? ""),
    pemilikKelompokId: row.pemilik_kelompok_id ? String(row.pemilik_kelompok_id) : null,
    pemilikKelompokNama: kelompok ? String(kelompok) : "Milik Bersama Lab",
    dapatDipinjamKelompokLain: Boolean(row.dapat_dipinjam_kelompok_lain),
  };
}

function mapLoan(row: Row): LoanRequest {
  const item = row.item as Row | null;
  const profile = row.profile as Row | null;
  const kelompok = row.kelompok as Row | null;
  return {
    id: String(row.id ?? ""),
    itemId: String(row.item_id ?? ""),
    itemName: item?.nama ? String(item.nama) : "-",
    itemCode: item?.kode ? String(item.kode) : "-",
    itemCategory: (item?.kategori ? String(item.kategori) : "komponen") as LoanRequest["itemCategory"],
    requesterId: String(row.user_id ?? ""),
    requesterName: profile?.nama ? String(profile.nama) : "-",
    requesterNim: profile?.nim ? String(profile.nim) : "-",
    requesterAvatar: profile?.avatar_url ? String(profile.avatar_url) : "",
    requesterKelompokId: row.kelompok_id ? String(row.kelompok_id) : undefined,
    requesterKelompokNama: kelompok?.nama ? String(kelompok.nama) : undefined,
    quantity: Number(row.jumlah ?? 0),
    projectPurpose: String(row.keperluan ?? ""),
    requestDate: formatTanggal(row.tanggal_pinjam),
    expectedReturnDate: formatTanggal(row.rencana_kembali),
    actualReturnDate: row.tanggal_kembali ? formatTanggal(row.tanggal_kembali) : undefined,
    status: String(row.status ?? "") as LoanRequest["status"],
    rejectionReason: row.catatan_admin ? String(row.catatan_admin) : undefined,
  };
}

function mapBooking(row: Row): RoomBooking {
  const profile = row.profile as Row | null;
  return {
    id: String(row.id ?? ""),
    roomId: String(row.ruangan_id ?? ""),
    roomName: String(row.nama_ruangan ?? ""),
    roomCode: String(row.ruangan_id ?? "").toUpperCase().slice(0, 7),
    capacity: 0,
    date: formatTanggal(row.waktu_mulai),
    timeSlot: `${formatJam(row.waktu_mulai)} - ${formatJam(row.waktu_selesai)} WIB`,
    startTime: String(row.waktu_mulai ?? ""),
    endTime: String(row.waktu_selesai ?? ""),
    picName: profile?.nama ? String(profile.nama) : "-",
    picNim: profile?.nim ? String(profile.nim) : "-",
    purpose: String(row.keperluan ?? ""),
    participantsCount: Number(row.jumlah_peserta ?? 0),
    status: String(row.status ?? "") as RoomBooking["status"],
  };
}

function mapReport(row: Row): LabReport {
  const profile = row.profile as Row | null;
  return {
    id: String(row.id ?? ""),
    itemId: row.item_id ? String(row.item_id) : undefined,
    userId: String(row.user_id ?? ""),
    kelompokId: row.kelompok_id ? String(row.kelompok_id) : undefined,
    type: String(row.jenis ?? "") === "habis" ? "habis" : "rusak",
    title: String(row.judul ?? ""),
    description: String(row.deskripsi ?? ""),
    location: String(row.lokasi ?? ""),
    reporterName: profile?.nama ? String(profile.nama) : "-",
    reporterRole: (profile?.role ? String(profile.role) : "anggota") as UserRole,
    createdAt: formatTanggal(row.created_at),
    urgency: String(row.urgensi ?? "") as LabReport["urgency"],
    status: String(row.status ?? "") as LabReport["status"],
    tindakan: row.tindakan ? String(row.tindakan) : undefined,
  };
}

function mapKelompok(row: Row): Kelompok {
  return {
    id: String(row.id ?? ""),
    nama: String(row.nama ?? ""),
    jenis: String(row.jenis ?? "") as Kelompok["jenis"],
    target_jam_mingguan:
      row.target_jam_mingguan == null ? null : Number(row.target_jam_mingguan),
  };
}

/** Ubah error Supabase menjadi pesan yang bisa dibaca pengguna. */
export function friendlyError(error: { message?: string; code?: string } | null): string {
  if (!error) return "Terjadi kesalahan tak terduga.";
  const message = error.message || "";
  if (
    error.code === "23P01" ||
    message.includes("no_overlapping_room_bookings") ||
    message.includes("exclusion constraint")
  ) {
    return "Ruangan sudah dipesan pada jam tersebut. Silakan pilih slot lain.";
  }
  if (error.code === "23505") {
    return "Data sudah ada (kode/NIM/nama mungkin duplikat).";
  }
  if (error.code === "23503") {
    return "Data terkait tidak ditemukan di database.";
  }
  if (error.code === "23514") {
    return "Data melanggar aturan database (stok atau jumlah tidak valid).";
  }
  return message || "Terjadi kesalahan pada database.";
}

async function fetchSnapshot() {
  const supabase = createClient();

  const [itemsRes, loansRes, bookingsRes, reportsRes, attendanceRes, kelompokRes] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("*, kelompok:pemilik_kelompok_id(nama)")
        .order("created_at", { ascending: false }),
      supabase
        .from("loan_requests")
        .select(
          "*, item:item_id(nama,kode,kategori), profile:user_id(nama,nim,avatar_url), kelompok:kelompok_id(nama)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("room_bookings")
        .select("*, profile:user_id(nama,nim)")
        .order("waktu_mulai", { ascending: true }),
      supabase
        .from("reports")
        .select("*, profile:user_id(nama,role)")
        .order("created_at", { ascending: false }),
      supabase
        .from("attendance_sessions")
        .select("id, user_id, check_in, check_out")
        .order("check_in", { ascending: false }),
      supabase.from("kelompok").select("id, nama, jenis, target_jam_mingguan"),
    ]);

  const firstError = [
    itemsRes.error,
    loansRes.error,
    bookingsRes.error,
    reportsRes.error,
    attendanceRes.error,
    kelompokRes.error,
  ].find(Boolean);

  if (firstError) throw new Error(friendlyError(firstError));

  return {
    items: (itemsRes.data ?? []).map(mapItem),
    loanRequests: (loansRes.data ?? []).map(mapLoan),
    roomBookings: (bookingsRes.data ?? []).map(mapBooking),
    labReports: (reportsRes.data ?? []).map(mapReport),
    attendanceSessions: (attendanceRes.data ?? []).map((row: Row) => ({
      id: String(row.id ?? ""),
      userId: String(row.user_id ?? ""),
      checkIn: String(row.check_in ?? ""),
      checkOut: row.check_out ? String(row.check_out) : null,
    })),
    kelompok: (kelompokRes.data ?? []).map(mapKelompok),
  };
}

const DEMO_SNAPSHOT = {
  items: MOCK_ITEMS,
  loanRequests: MOCK_LOAN_REQUESTS,
  roomBookings: MOCK_ROOM_BOOKINGS,
  labReports: MOCK_LAB_REPORTS,
  attendanceSessions: [] as AttendanceSession[],
  kelompok: MOCK_KELOMPOK,
};

const EMPTY_SNAPSHOT = {
  items: [] as Item[],
  loanRequests: [] as LoanRequest[],
  roomBookings: [] as RoomBooking[],
  labReports: [] as LabReport[],
  attendanceSessions: [] as AttendanceSession[],
  kelompok: [] as Kelompok[],
};

const DEMO_BLOCKED: ActionResult = {
  success: false,
  error: "MODE DEMO: perubahan tidak disimpan ke database.",
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useRole();
  const [snapshot, setSnapshot] = useState(DEMO_MODE ? DEMO_SNAPSHOT : EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(!DEMO_MODE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refreshData = async () => {
    if (DEMO_MODE) return;
    try {
      const next = await fetchSnapshot();
      if (!mounted.current) return;
      setSnapshot(next);
      setLoadError(null);
    } catch (err) {
      if (!mounted.current) return;
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data dari database.");
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Muat data setelah sesi tersedia (identitas & RLS butuh user yang login).
  useEffect(() => {
    if (DEMO_MODE) return;
    if (!currentUser) {
      setSnapshot(EMPTY_SNAPSHOT);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Muat data sekali per pengguna; setState terjadi setelah await, bukan render berantai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshData();
  }, [currentUser?.id]);

  const addInventoryItem = async (newItem: Omit<Item, "id">): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    const supabase = createClient();
    const { error } = await supabase.from("inventory_items").insert([
      {
        nama: newItem.name,
        kode: newItem.code,
        kategori: newItem.category,
        lokasi: newItem.location,
        stok_total: newItem.totalStock,
        stok_tersedia: newItem.availableStock,
        status: newItem.status,
        spesifikasi: newItem.specs,
        pemilik_kelompok_id: newItem.pemilikKelompokId || null,
        dapat_dipinjam_kelompok_lain: newItem.dapatDipinjamKelompokLain ?? false,
      },
    ]);
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const addStockToItem = async (itemId: string, quantity: number): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    if (quantity <= 0) return { success: false, error: "Jumlah unit harus lebih dari 0." };

    const supabase = createClient();
    const { error } = await supabase.rpc("tambah_stok_inventory", {
      p_item_id: itemId,
      p_jumlah: quantity,
    });
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const addLoanRequest = async (
    newReq: Omit<LoanRequest, "id" | "requestDate" | "status">
  ): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    const supabase = createClient();
    const { error } = await supabase.from("loan_requests").insert([
      {
        item_id: newReq.itemId,
        user_id: newReq.requesterId,
        kelompok_id: newReq.requesterKelompokId,
        jumlah: newReq.quantity,
        keperluan: newReq.projectPurpose,
        rencana_kembali: newReq.expectedReturnDate,
      },
    ]);
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const updateLoanRequestStatus = async (
    id: string,
    status: LoanActionStatus,
    note?: string
  ): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    const supabase = createClient();
    const { error } =
      status === "selesai"
        ? await supabase.rpc("selesaikan_pinjam", { p_loan_id: id })
        : await supabase.rpc("verifikasi_pinjam", {
            p_loan_id: id,
            p_setuju: status === "disetujui",
            p_alasan: note ?? null,
          });
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const addRoomBooking = async (
    booking: Omit<RoomBooking, "id" | "status">
  ): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    if (!booking.startTime || !booking.endTime) {
      return { success: false, error: "Tanggal dan jam sesi belum lengkap." };
    }

    // Pemeriksaan bentrok di klien memakai rentang waktu, bukan label.
    // Constraint GiST di database tetap penjaga terakhir.
    const bentrok = snapshot.roomBookings.some(
      (b) =>
        b.status === "aktif" &&
        b.roomId === booking.roomId &&
        b.startTime &&
        b.endTime &&
        overlaps(b.startTime, b.endTime, booking.startTime!, booking.endTime!)
    );
    if (bentrok) {
      return {
        success: false,
        error: `Ruangan ${booking.roomName} sudah dipesan pada jam tersebut. Silakan pilih slot lain.`,
      };
    }

    const supabase = createClient();
    const { error } = await supabase.from("room_bookings").insert([
      {
        ruangan_id: booking.roomId || "lab-utama",
        nama_ruangan: booking.roomName,
        user_id: booking.userId,
        kelompok_id: booking.kelompokId,
        waktu_mulai: booking.startTime,
        waktu_selesai: booking.endTime,
        keperluan: booking.purpose,
        jumlah_peserta: booking.participantsCount,
        status: "aktif",
      },
    ]);
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const addLabReport = async (
    report: Omit<LabReport, "id" | "createdAt" | "status">
  ): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert([
      {
        item_id: report.itemId || null,
        user_id: report.userId,
        kelompok_id: report.kelompokId,
        judul: report.title,
        deskripsi: report.description,
        lokasi: report.location,
        jenis: report.type,
        urgensi: report.urgency,
      },
    ]);
    if (error) return { success: false, error: friendlyError(error) };
    await refreshData();
    return { success: true };
  };

  const updateReportStatus = async (
    id: string,
    status: ReportActionStatus
  ): Promise<ActionResult> => {
    if (DEMO_MODE) return DEMO_BLOCKED;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", id)
      .select("id");
    if (error) return { success: false, error: friendlyError(error) };
    if (!data || data.length === 0) {
      return { success: false, error: "Laporan tidak ditemukan atau Anda tidak berhak mengubahnya." };
    }
    await refreshData();
    return { success: true };
  };

  return (
    <DataContext.Provider
      value={{
        ...snapshot,
        isLoading,
        loadError,
        addInventoryItem,
        addStockToItem,
        addLoanRequest,
        updateLoanRequestStatus,
        addRoomBooking,
        addLabReport,
        updateReportStatus,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
