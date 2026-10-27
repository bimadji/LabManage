"use client";

import React, { createContext, useContext, useState } from "react";
import { Item, LoanRequest, RoomBooking, LabReport } from "@/types";
import {
  MOCK_ITEMS,
  MOCK_LOAN_REQUESTS,
  MOCK_ROOM_BOOKINGS,
  MOCK_LAB_REPORTS,
} from "@/lib/mock-data";

interface DataContextType {
  items: Item[];
  loanRequests: LoanRequest[];
  roomBookings: RoomBooking[];
  labReports: LabReport[];
  addLoanRequest: (req: Omit<LoanRequest, "id" | "requestDate" | "status">) => void;
  updateLoanRequestStatus: (
    id: string,
    status: "disetujui" | "ditolak",
    rejectionReason?: string
  ) => void;
  addRoomBooking: (booking: Omit<RoomBooking, "id" | "status">) => void;
  addLabReport: (report: Omit<LabReport, "id" | "createdAt" | "status">) => void;
  updateReportStatus: (id: string, status: "ditangani" | "selesai") => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>(MOCK_LOAN_REQUESTS);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>(MOCK_ROOM_BOOKINGS);
  const [labReports, setLabReports] = useState<LabReport[]>(MOCK_LAB_REPORTS);

  const addLoanRequest = (newReq: Omit<LoanRequest, "id" | "requestDate" | "status">) => {
    const today = new Date().toISOString().split("T")[0];
    const created: LoanRequest = {
      ...newReq,
      id: `req-${Date.now().toString().slice(-4)}`,
      requestDate: today,
      status: "menunggu",
    };
    setLoanRequests((prev) => [created, ...prev]);

    // Kurangi stok jika tersedia
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
  };

  const updateLoanRequestStatus = (
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

    // Jika ditolak, kembalikan stok
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

  const addRoomBooking = (booking: Omit<RoomBooking, "id" | "status">) => {
    const created: RoomBooking = {
      ...booking,
      id: `bkg-${Date.now().toString().slice(-4)}`,
      status: "aktif",
    };
    setRoomBookings((prev) => [created, ...prev]);
  };

  const addLabReport = (report: Omit<LabReport, "id" | "createdAt" | "status">) => {
    const created: LabReport = {
      ...report,
      id: `rep-${Date.now().toString().slice(-4)}`,
      createdAt: "Hari ini, baru saja",
      status: "menunggu",
    };
    setLabReports((prev) => [created, ...prev]);
  };

  const updateReportStatus = (id: string, status: "ditangani" | "selesai") => {
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
