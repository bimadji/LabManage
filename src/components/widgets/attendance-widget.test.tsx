import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const roleState = { teamType: "tim_riset" as "tim_riset" | "ukm" };

vi.mock("@/contexts/role-context", () => ({
  useRole: () => ({ role: "anggota", currentUser: null, isLoading: false, isDemoMode: false }),
  useCurrentUser: () => ({
    id: "u1",
    name: "Uji",
    nimOrNip: "1",
    role: "anggota",
    avatar: "",
    email: "u@test.local",
    team: roleState.teamType === "ukm" ? "Roboholic" : "Tim Riset EROS",
    teamId: "k1",
    teamType: roleState.teamType,
    weeklyTargetHours: roleState.teamType === "ukm" ? null : 10,
  }),
}));

vi.mock("@/contexts/attendance-context", () => ({
  useAttendance: () => ({
    isCheckedIn: false,
    checkInTime: null,
    elapsedSeconds: 0,
    weeklyAccumulatedHours: 3.5,
    weeklyTargetHours: 10,
    hasOpenSession: false,
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    formattedElapsed: "00:00:00",
  }),
}));

import { AttendanceWidget } from "@/components/widgets/attendance-widget";

describe("AttendanceWidget — batas per jenis kelompok", () => {
  beforeEach(() => {
    roleState.teamType = "tim_riset";
  });

  it("anggota tim riset melihat tombol Check-In", () => {
    roleState.teamType = "tim_riset";
    render(<AttendanceWidget />);
    expect(screen.getByRole("button", { name: /Check-In Sekarang/i })).toBeInTheDocument();
  });

  it("anggota UKM TIDAK melihat Check-In, hanya kartu bebas target jam", () => {
    roleState.teamType = "ukm";
    render(<AttendanceWidget />);
    expect(screen.queryByRole("button", { name: /Check-In/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Bebas Target Jam Lab Mingguan/i)).toBeInTheDocument();
  });
});
