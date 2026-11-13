import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UserRole } from "@/types";

const roleState = { role: "admin" as UserRole };

vi.mock("@/contexts/role-context", () => ({
  useRole: () => ({ role: roleState.role, currentUser: null, isLoading: false, isDemoMode: false }),
  useCurrentUser: () => ({
    id: "u1",
    name: "Uji",
    nimOrNip: "1",
    role: roleState.role,
    avatar: "",
    email: "u@test.local",
    team: "Tim",
    teamId: "k1",
    teamType: "tim_riset",
    weeklyTargetHours: 10,
  }),
}));

vi.mock("@/contexts/overlay-context", () => ({
  useOverlay: () => ({
    activeSheet: "review",
    activeDialog: null,
    closeAllOverlays: vi.fn(),
    selectedItemForLoan: null,
    selectedRequestForReview: {
      id: "r1",
      itemId: "i1",
      itemName: "Sensor",
      itemCode: "S-1",
      itemCategory: "sensor",
      requesterId: "u2",
      requesterName: "Anggota",
      requesterNim: "2",
      requesterAvatar: "",
      quantity: 1,
      projectPurpose: "Uji",
      requestDate: "12 Nov 2026",
      expectedReturnDate: "19 Nov 2026",
      status: "menunggu",
    },
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
    updateLoanRequestStatus: vi.fn().mockResolvedValue({ success: true }),
    updateReportStatus: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

import { ReviewRequestSheet } from "@/components/overlays/review-request-sheet";

describe("ReviewRequestSheet — batas aksi tulis per role", () => {
  beforeEach(() => {
    roleState.role = "admin";
  });

  it("admin melihat tombol Setujui dan Tolak", () => {
    roleState.role = "admin";
    render(<ReviewRequestSheet />);
    expect(screen.getByRole("button", { name: /Setujui Peminjaman/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tolak/i })).toBeInTheDocument();
  });

  it("advisor TIDAK melihat tombol Setujui, Tolak, maupun Tandai Dikembalikan", () => {
    roleState.role = "advisor";
    render(<ReviewRequestSheet />);
    expect(screen.queryByRole("button", { name: /Setujui Peminjaman/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tolak/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tandai Dikembalikan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/hanya memantau/i)).toBeInTheDocument();
  });

  it("anggota juga tidak melihat aksi verifikasi", () => {
    roleState.role = "anggota";
    render(<ReviewRequestSheet />);
    expect(screen.queryByRole("button", { name: /Setujui Peminjaman/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tolak/i })).not.toBeInTheDocument();
  });
});
