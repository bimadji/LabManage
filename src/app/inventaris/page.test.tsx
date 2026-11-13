import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UserRole } from "@/types";

const roleState = { role: "anggota" as UserRole };

vi.mock("@/contexts/role-context", () => ({
  useRole: () => ({ role: roleState.role, currentUser: null, isLoading: false, isDemoMode: false }),
  useCurrentUser: () => ({
    id: "u1",
    name: "Uji",
    nimOrNip: "1",
    role: roleState.role,
    avatar: "",
    email: "u@test.local",
    team: "Tim Riset EROS",
    teamId: "k1",
    teamType: "tim_riset",
    weeklyTargetHours: 10,
  }),
}));

vi.mock("@/contexts/overlay-context", () => ({
  useOverlay: () => ({
    activeSheet: null,
    activeDialog: null,
    closeAllOverlays: vi.fn(),
    selectedItemForLoan: null,
    selectedRequestForReview: null,
    selectedReportForReview: null,
    openLoanSheet: vi.fn(),
    openBookingDialog: vi.fn(),
    openReportDialog: vi.fn(),
    openReviewSheet: vi.fn(),
    openReportReviewSheet: vi.fn(),
  }),
}));

vi.mock("@/contexts/data-context", () => ({
  useData: () => ({
    items: [
      {
        id: "i1",
        name: "Sensor Uji",
        code: "S-1",
        category: "sensor",
        categoryLabel: "Sensor",
        totalStock: 3,
        availableStock: 2,
        location: "Rak A",
        status: "tersedia",
        specs: "",
        pemilikKelompokId: null,
        pemilikKelompokNama: "Milik Bersama Lab",
        dapatDipinjamKelompokLain: true,
      },
    ],
    kelompok: [],
    loanRequests: [],
    labReports: [],
    roomBookings: [],
    attendanceSessions: [],
  }),
}));

import InventarisPage from "@/app/inventaris/page";

describe("Halaman Inventaris — batas tombol per role", () => {
  beforeEach(() => {
    roleState.role = "anggota";
  });

  it("anggota melihat Ajukan Pinjam Barang dan TIDAK melihat Tambah Barang Baru", () => {
    roleState.role = "anggota";
    render(<InventarisPage />);
    expect(screen.getByRole("button", { name: /Ajukan Pinjam Barang/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tambah Barang Baru/i })).not.toBeInTheDocument();
  });

  it("admin melihat Tambah Barang Baru dan TIDAK melihat Ajukan Pinjam Barang", () => {
    roleState.role = "admin";
    render(<InventarisPage />);
    expect(screen.getByRole("button", { name: /Tambah Barang Baru/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajukan Pinjam Barang/i })).not.toBeInTheDocument();
  });

  it("advisor boleh mengajukan pinjam (PRD §3) tapi TIDAK melihat Tambah Barang Baru", () => {
    // PRD §3: Advisor "Pinjam Alat Lab & Barang Terbuka" = Ya; yang dilarang hanya verifikasi.
    roleState.role = "advisor";
    render(<InventarisPage />);
    expect(screen.getByRole("button", { name: /Ajukan Pinjam Barang/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tambah Barang Baru/i })).not.toBeInTheDocument();
  });
});
