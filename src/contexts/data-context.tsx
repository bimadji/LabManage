"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { Item, LoanRequest, RoomBooking, LabReport } from "@/types";
import {
  MOCK_ITEMS,
  MOCK_LOAN_REQUESTS,
  MOCK_ROOM_BOOKINGS,
  MOCK_LAB_REPORTS,
} from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

interface DataContextType {
  items: Item[];
  loanRequests: LoanRequest[];
  roomBookings: RoomBooking[];
  labReports: LabReport[];
  addLoanRequest: (req: Omit<LoanRequest, "id" | "requestDate" | "status">) => Promise<boolean>;
  updateLoanRequestStatus: (
    id: string,
    status: "disetujui" | "ditolak",
    rejectionReason?: string
  ) => Promise<void>;
  addRoomBooking: (booking: Omit<RoomBooking, "id" | "status">) => Promise<{ success: boolean; error?: string }>;
  addLabReport: (report: Omit<LabReport, "id" | "createdAt" | "status">) => Promise<void>;
  updateReportStatus: (id: string, status: "ditangani" | "selesai") => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>(MOCK_LOAN_REQUESTS);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>(MOCK_ROOM_BOOKINGS);
  const [labReports, setLabReports] = useState<LabReport[]>(MOCK_LAB_REPORTS);

  const refreshData = async () => {
    try {
      const supabase = createClient();

      const { data: dbItems, error: itemsErr } = await supabase
        .from("inventory_items")
        .select("*, kelompok:pemilik_kelompok_id(nama)");

      if (!itemsErr && dbItems && dbItems.length > 0) {
        const mappedItems: Item[] = dbItems.map((it: any) => ({
          id: it.id,
          name: it.nama,
          code: it.kode,
          category: it.kategori,
          categoryLabel: it.kategori.charAt(0).toUpperCase() + it.kategori.slice(1),
          totalStock: it.stok_total,
          availableStock: it.stok_tersedia,
          location: it.lokasi,
          status: it.status,
          specs: it.spesifikasi || "",
          pemilikKelompokId: it.pemilik_kelompok_id,
          pemilikKelompokNama: it.kelompok?.nama || "Milik Bersama Lab",
          dapatDipinjamKelompokLain: it.dapat_dipinjam_kelompok_lain,
        }));
        setItems(mappedItems);
      }

      const { data: dbBookings, error: bkgErr } = await supabase
        .from("room_bookings")
        .select("*, profiles:user_id(nama, nim), kelompok:kelompok_id(nama)")
        .order("waktu_mulai", { ascending: true });

      if (!bkgErr && dbBookings && dbBookings.length > 0) {
        const mappedBookings: RoomBooking[] = dbBookings.map((b: any) => {
          const start = new Date(b.waktu_mulai);
          const end = new Date(b.waktu_selesai);
          const timeSlot = `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")} - ${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")} WIB`;
          return {
            id: b.id,
            roomId: b.ruangan_id,
            roomName: b.nama_ruangan,
            roomCode: b.ruangan_id.toUpperCase().slice(0, 7),
            capacity: 25,
            date: start.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }),
            timeSlot,
            startTime: b.waktu_mulai,
            endTime: b.waktu_selesai,
            picName: b.profiles?.nama || "Anggota",
            picNim: b.profiles?.nim || "-",
            purpose: b.keperluan,
            participantsCount: b.jumlah_peserta,
            status: b.status,
          };
        });
        setRoomBookings(mappedBookings);
      }
    } catch {
      // Fallback retained
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const addLoanRequest = async (newReq: Omit<LoanRequest, "id" | "requestDate" | "status">): Promise<boolean> => {
    const today = new Date().toISOString().split("T")[0];
    const created: LoanRequest = {
      ...newReq,
      id: `req-${Date.now().toString().slice(-4)}`,
      requestDate: today,
      status: "menunggu",
    };
    setLoanRequests((prev) => [created, ...prev]);

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === newReq.itemId) {
          const newAvail = Math.max(0, it.availableStock - newReq.quantity);
          return {
            ...it,
            availableStock: newAvail,
            status: newAvail === 0 ? "dipinjam" : it.status,
          };
        }
        return it;
      })
    );

    try {
      const supabase = createClient();
      await supabase.from("loan_requests").insert([
        {
          item_id: newReq.itemId,
          user_id: newReq.requesterId,
          kelompok_id: newReq.requesterKelompokId,
          jumlah: newReq.quantity,
          keperluan: newReq.projectPurpose,
          rencana_kembali: newReq.expectedReturnDate,
        },
      ]);
    } catch {
      // Optimistic update retained
    }
    return true;
  };

  const updateLoanRequestStatus = async (
    id: string,
    status: "disetujui" | "ditolak",
    rejectionReason?: string
  ) => {
    setLoanRequests((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            status,
            rejectionReason: rejectionReason || r.rejectionReason,
          };
        }
        return r;
      })
    );

    if (status === "ditolak") {
      const targetReq = loanRequests.find((r) => r.id === id);
      if (targetReq) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id === targetReq.itemId) {
              const restoredStock = Math.min(it.totalStock, it.availableStock + targetReq.quantity);
              return {
                ...it,
                availableStock: restoredStock,
                status: "tersedia",
              };
            }
            return it;
          })
        );
      }
    }
  };

  const addRoomBooking = async (
    booking: Omit<RoomBooking, "id" | "status">
  ): Promise<{ success: boolean; error?: string }> => {
    const hasConflict = roomBookings.some(
      (b) =>
        b.status === "aktif" &&
        b.roomName === booking.roomName &&
        b.date === booking.date &&
        b.timeSlot === booking.timeSlot
    );

    if (hasConflict) {
      return {
        success: false,
        error: `Jadwal bentrok! Ruangan ${booking.roomName} sudah dipesan untuk slot ${booking.timeSlot} pada hari ${booking.date}.`,
      };
    }

    const created: RoomBooking = {
      ...booking,
      id: `bkg-${Date.now().toString().slice(-4)}`,
      status: "aktif",
    };
    setRoomBookings((prev) => [created, ...prev]);

    try {
      const supabase = createClient();
      await supabase.from("room_bookings").insert([
        {
          ruangan_id: booking.roomId || "lab-utama",
          nama_ruangan: booking.roomName,
          user_id: booking.userId,
          kelompok_id: booking.kelompokId,
          waktu_mulai: booking.startTime || new Date().toISOString(),
          waktu_selesai: booking.endTime || new Date(Date.now() + 4 * 3600000).toISOString(),
          keperluan: booking.purpose,
          jumlah_peserta: booking.participantsCount,
          status: "aktif",
        },
      ]);
    } catch {
      // Optimistic update retained
    }

    return { success: true };
  };

  const addLabReport = async (report: Omit<LabReport, "id" | "createdAt" | "status">) => {
    const created: LabReport = {
      ...report,
      id: `rep-${Date.now().toString().slice(-4)}`,
      createdAt: "Hari ini, baru saja",
      status: "menunggu",
    };
    setLabReports((prev) => [created, ...prev]);
  };

  const updateReportStatus = async (id: string, status: "ditangani" | "selesai") => {
    setLabReports((prev) =>
      prev.map((rep) => (rep.id === id ? { ...rep, status } : rep))
    );
  };

  return (
    <DataContext.Provider
      value={{
        items,
        loanRequests,
        roomBookings,
        labReports,
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
