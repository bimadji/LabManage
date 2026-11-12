import { describe, it, expect } from "vitest";
import { overlaps, toWibIso, todayWib } from "@/lib/rooms";

describe("toWibIso", () => {
  it("mengubah tanggal + jam WIB ke timestamp UTC", () => {
    expect(toWibIso("2026-11-20", "13:30")).toBe("2026-11-20T06:30:00.000Z");
    expect(toWibIso("2026-11-20", "08:00")).toBe("2026-11-20T01:00:00.000Z");
  });

  it("mengembalikan null untuk tanggal/jam tidak valid", () => {
    expect(toWibIso("61120-02-20", "13:30")).toBeNull();
    expect(toWibIso("", "13:30")).toBeNull();
  });
});

describe("overlaps", () => {
  it("menandai rentang yang tumpang tindih", () => {
    expect(
      overlaps(
        "2026-11-20T06:30:00Z",
        "2026-11-20T10:30:00Z",
        "2026-11-20T08:00:00Z",
        "2026-11-20T12:00:00Z"
      )
    ).toBe(true);
  });

  it("tidak menandai rentang bersebelahan (samping, bukan tumpang tindih)", () => {
    expect(
      overlaps(
        "2026-11-20T01:00:00Z",
        "2026-11-20T05:00:00Z",
        "2026-11-20T06:30:00Z",
        "2026-11-20T10:30:00Z"
      )
    ).toBe(false);
  });

  it("menandai rentang yang sepenuhnya berada di dalam rentang lain", () => {
    expect(
      overlaps(
        "2026-11-20T01:00:00Z",
        "2026-11-20T12:00:00Z",
        "2026-11-20T06:30:00Z",
        "2026-11-20T07:00:00Z"
      )
    ).toBe(true);
  });
});

describe("todayWib", () => {
  it("menghasilkan format YYYY-MM-DD", () => {
    expect(todayWib()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
