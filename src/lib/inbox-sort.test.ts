import { describe, it, expect } from "vitest";
import { sortByStatusPriority } from "./inbox-sort";

describe("sortByStatusPriority — urutan Kotak Masuk", () => {
  it("menaruh menunggu paling atas, lalu ditolak, disetujui, ditangani, selesai", () => {
    const items = [
      { id: "a", status: "selesai" as const },
      { id: "b", status: "disetujui" as const },
      { id: "c", status: "menunggu" as const },
      { id: "d", status: "ditolak" as const },
      { id: "e", status: "ditangani" as const },
    ];
    expect(sortByStatusPriority(items).map((i) => i.id)).toEqual(["c", "d", "b", "e", "a"]);
  });

  it("mempertahankan urutan asli di dalam status yang sama", () => {
    const items = [
      { id: "baru", status: "menunggu" as const },
      { id: "lama", status: "menunggu" as const },
      { id: "disetujui", status: "disetujui" as const },
    ];
    expect(sortByStatusPriority(items).map((i) => i.id)).toEqual(["baru", "lama", "disetujui"]);
  });

  it("tidak mengubah array masukan", () => {
    const items = [
      { id: "a", status: "selesai" as const },
      { id: "b", status: "menunggu" as const },
    ];
    sortByStatusPriority(items);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
