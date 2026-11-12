import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock,
}));

vi.mock("@/contexts/role-context", () => ({
  useRole: () => ({ role: "admin", currentUser: null, isLoading: false, isDemoMode: false }),
  useCurrentUser: () => ({
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    name: "Admin Uji",
    nimOrNip: "1001",
    role: "admin",
    avatar: "",
    email: "admin@test.local",
    team: "Tim Uji",
    teamId: "99999999-0000-0000-0000-000000000001",
    teamType: "tim_riset",
    weeklyTargetHours: 10,
  }),
}));

vi.mock("@/contexts/overlay-context", () => ({
  useOverlay: () => ({
    activeSheet: null,
    activeDialog: null,
    closeAllOverlays: vi.fn(),
    openLoanSheet: vi.fn(),
    openBookingDialog: vi.fn(),
    openReportDialog: vi.fn(),
    openReviewSheet: vi.fn(),
    openReportReviewSheet: vi.fn(),
    selectedItemForLoan: null,
    selectedRequestForReview: null,
    selectedReportForReview: null,
  }),
}));

import { DataProvider, useData } from "@/contexts/data-context";

function Probe() {
  const { addInventoryItem, addStockToItem, addLoanRequest, addRoomBooking, updateReportStatus } =
    useData();
  return (
    <div>
      <button
        onClick={async () => {
          const r = await addInventoryItem({
            name: "Barang Uji",
            code: "UJI-1",
            category: "sensor",
            categoryLabel: "Sensor",
            totalStock: 1,
            availableStock: 1,
            location: "Rak",
            status: "tersedia",
            specs: "",
          });
          document.body.dataset.addItem = JSON.stringify(r);
        }}
      >
        tambah barang
      </button>
      <button
        onClick={async () => {
          const r = await addStockToItem("bbbbbbbb-0000-0000-0000-000000000001", 2);
          document.body.dataset.addStock = JSON.stringify(r);
        }}
      >
        tambah stok
      </button>
      <button
        onClick={async () => {
          const r = await addLoanRequest({
            itemId: "bbbbbbbb-0000-0000-0000-000000000001",
            itemName: "Barang Uji",
            itemCode: "UJI-1",
            itemCategory: "sensor",
            requesterId: "aaaaaaaa-0000-0000-0000-000000000002",
            requesterName: "Anggota Uji",
            requesterNim: "1002",
            requesterAvatar: "",
            requesterKelompokId: "99999999-0000-0000-0000-000000000001",
            requesterKelompokNama: "Tim Uji",
            quantity: 1,
            projectPurpose: "Uji",
            expectedReturnDate: "2026-12-01",
          });
          document.body.dataset.addLoan = JSON.stringify(r);
        }}
      >
        ajukan pinjam
      </button>
      <button
        onClick={async () => {
          const r = await addRoomBooking({
            roomId: "arena-kontes",
            roomName: "Arena Uji Coba KRAI / KRI",
            roomCode: "ARENA-01",
            capacity: 25,
            date: "2026-11-20",
            timeSlot: "13:30 - 17:30 WIB (Siang)",
            picName: "Admin Uji",
            picNim: "1001",
            userId: "aaaaaaaa-0000-0000-0000-000000000001",
            kelompokId: "99999999-0000-0000-0000-000000000001",
            kelompokNama: "Tim Uji",
            purpose: "Uji",
            participantsCount: 5,
          });
          document.body.dataset.addBooking = JSON.stringify(r);
        }}
      >
        pesan ruang tanpa jam
      </button>
      <button
        onClick={async () => {
          const r = await addRoomBooking({
            roomId: "arena-kontes",
            roomName: "Arena Uji Coba KRAI / KRI",
            roomCode: "ARENA-01",
            capacity: 25,
            date: "2026-11-20",
            timeSlot: "13:30 - 17:30 WIB (Siang)",
            startTime: "2026-11-20T06:30:00.000Z",
            endTime: "2026-11-20T10:30:00.000Z",
            picName: "Admin Uji",
            picNim: "1001",
            userId: "aaaaaaaa-0000-0000-0000-000000000001",
            kelompokId: "99999999-0000-0000-0000-000000000001",
            kelompokNama: "Tim Uji",
            purpose: "Uji",
            participantsCount: 5,
          });
          document.body.dataset.addBooking = JSON.stringify(r);
        }}
      >
        pesan ruang dengan jam
      </button>
      <button
        onClick={async () => {
          const r = await updateReportStatus("cccccccc-0000-0000-0000-000000000001", "ditangani");
          document.body.dataset.reportStatus = JSON.stringify(r);
        }}
      >
        ubah status laporan
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <DataProvider>
      <Probe />
    </DataProvider>
  );
}

describe("DataContext — jalur gagal tidak boleh pura-pura sukses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete document.body.dataset.addItem;
    delete document.body.dataset.addStock;
    delete document.body.dataset.addLoan;
    delete document.body.dataset.addBooking;
    delete document.body.dataset.reportStatus;
    // Pemuatan data awal: semua select mengembalikan array kosong.
    supabaseMock.from.mockReturnValue({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    });
  });

  it("menambah barang: melaporkan error Supabase, tanpa membuat data palsu", async () => {
    const user = userEvent.setup();
    supabaseMock.from.mockReturnValue({
      insert: () => Promise.resolve({ data: null, error: { message: "kode sudah dipakai" } }),
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });

    renderProvider();
    await user.click(screen.getByText("tambah barang"));

    await waitFor(() => expect(document.body.dataset.addItem).toBeDefined());
    const result = JSON.parse(document.body.dataset.addItem!);
    expect(result.success).toBe(false);
    expect(result.error).toBe("kode sudah dipakai");
  });

  it("menambah stok: melaporkan error RPC, tanpa menambalkan stok lokal", async () => {
    const user = userEvent.setup();
    supabaseMock.rpc.mockResolvedValue({ error: { message: "Akses ditolak" } });

    renderProvider();
    await user.click(screen.getByText("tambah stok"));

    await waitFor(() => expect(document.body.dataset.addStock).toBeDefined());
    const result = JSON.parse(document.body.dataset.addStock!);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });

  it("mengajukan pinjam: melaporkan error insert, tidak membuat permintaan palsu", async () => {
    const user = userEvent.setup();
    supabaseMock.from.mockReturnValue({
      insert: () => Promise.resolve({ data: null, error: { message: "RLS menolak" } }),
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });

    renderProvider();
    await user.click(screen.getByText("ajukan pinjam"));

    await waitFor(() => expect(document.body.dataset.addLoan).toBeDefined());
    const result = JSON.parse(document.body.dataset.addLoan!);
    expect(result.success).toBe(false);
    expect(result.error).toBe("RLS menolak");
  });

  it("memesan ruang tanpa jam sesi: ditolak sebelum menulis ke DB", async () => {
    const user = userEvent.setup();
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseMock.from.mockReturnValue({
      insert,
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });

    renderProvider();
    await user.click(screen.getByText("pesan ruang tanpa jam"));

    await waitFor(() => expect(document.body.dataset.addBooking).toBeDefined());
    const result = JSON.parse(document.body.dataset.addBooking!);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tanggal dan jam sesi belum lengkap");
    expect(insert).not.toHaveBeenCalled();
  });

  it("memesan ruang dengan rentang waktu: menulis start/end ke database", async () => {
    const user = userEvent.setup();
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseMock.from.mockReturnValue({
      insert,
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });

    renderProvider();
    await user.click(screen.getByText("pesan ruang dengan jam"));

    await waitFor(() => expect(document.body.dataset.addBooking).toBeDefined());
    const result = JSON.parse(document.body.dataset.addBooking!);
    expect(result.success).toBe(true);
    expect(insert).toHaveBeenCalled();
    const row = insert.mock.calls[0][0][0];
    expect(row.waktu_mulai).toBe("2026-11-20T06:30:00.000Z");
    expect(row.waktu_selesai).toBe("2026-11-20T10:30:00.000Z");
    expect(row.ruangan_id).toBe("arena-kontes");
  });

  it("mengubah status laporan: 0 baris terpengaruh = akses ditolak", async () => {
    const user = userEvent.setup();
    supabaseMock.from.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    });

    renderProvider();
    await user.click(screen.getByText("ubah status laporan"));

    await waitFor(() => expect(document.body.dataset.reportStatus).toBeDefined());
    const result = JSON.parse(document.body.dataset.reportStatus!);
    expect(result.success).toBe(false);
    expect(result.error).toContain("tidak berhak");
  });
});
