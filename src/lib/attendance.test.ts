import { describe, it, expect } from "vitest";
import { getWeekRange, hoursForUser, minutesWithin, openSessionFor } from "@/lib/attendance";

const WIB = "Asia/Jakarta";

describe("getWeekRange", () => {
  it("mulai hari Senin 00:00 WIB dan berakhir 7 hari kemudian", () => {
    // Rabu 2026-11-11 10:00 WIB = 2026-11-11T03:00:00Z
    const now = new Date("2026-11-11T03:00:00Z");
    const { start, end } = getWeekRange(now);
    expect(start.toISOString()).toBe("2026-11-08T17:00:00.000Z"); // Senin 00:00 WIB
    expect(end.toISOString()).toBe("2026-11-15T17:00:00.000Z"); // Senin berikutnya 00:00 WIB
  });

  it("batas minggu tetap Senin meski hari Minggu", () => {
    // Minggu 2026-11-15 09:00 WIB = 2026-11-15T02:00:00Z
    const { start } = getWeekRange(new Date("2026-11-15T02:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });
});

describe("minutesWithin", () => {
  const start = new Date("2026-11-09T00:00:00Z");
  const end = new Date("2026-11-16T00:00:00Z");

  it("menghitung durasi penuh sesi di dalam periode", () => {
    expect(
      minutesWithin(
        { userId: "u1", checkIn: "2026-11-10T01:00:00Z", checkOut: "2026-11-10T03:00:00Z" },
        start,
        end
      )
    ).toBe(120);
  });

  it("memotong sesi yang melewati awal periode", () => {
    expect(
      minutesWithin(
        { userId: "u1", checkIn: "2026-11-08T22:00:00Z", checkOut: "2026-11-09T01:00:00Z" },
        start,
        end
      )
    ).toBe(60);
  });

  it("memotong sesi yang melewati akhir periode", () => {
    expect(
      minutesWithin(
        { userId: "u1", checkIn: "2026-11-15T22:00:00Z", checkOut: "2026-11-16T02:00:00Z" },
        start,
        end
      )
    ).toBe(120);
  });

  it("mengabaikan sesi di luar periode", () => {
    expect(
      minutesWithin(
        { userId: "u1", checkIn: "2026-10-01T01:00:00Z", checkOut: "2026-10-01T02:00:00Z" },
        start,
        end
      )
    ).toBe(0);
  });

  it("menghitung sesi terbuka sampai `now`", () => {
    expect(
      minutesWithin(
        { userId: "u1", checkIn: "2026-11-10T01:00:00Z", checkOut: null },
        start,
        end,
        new Date("2026-11-10T04:30:00Z")
      )
    ).toBe(210);
  });
});

describe("hoursForUser", () => {
  const start = new Date("2026-11-09T00:00:00Z");
  const end = new Date("2026-11-16T00:00:00Z");

  it("menjumlahkan hanya sesi milik user tersebut", () => {
    const hours = hoursForUser(
      [
        { userId: "u1", checkIn: "2026-11-10T01:00:00Z", checkOut: "2026-11-10T03:00:00Z" },
        { userId: "u2", checkIn: "2026-11-10T01:00:00Z", checkOut: "2026-11-10T09:00:00Z" },
      ],
      "u1",
      start,
      end
    );
    expect(hours).toBe(2);
  });

  it("mengembalikan 0 bila tidak ada sesi", () => {
    expect(hoursForUser([], "u1", start, end)).toBe(0);
  });
});

describe("openSessionFor", () => {
  it("menemukan sesi tanpa check_out", () => {
    const sessions = [
      { userId: "u1", checkIn: "2026-11-10T01:00:00Z", checkOut: "2026-11-10T03:00:00Z" },
      { userId: "u1", checkIn: "2026-11-11T01:00:00Z", checkOut: null },
    ];
    expect(openSessionFor(sessions, "u1")?.checkIn).toBe("2026-11-11T01:00:00Z");
  });

  it("mengembalikan null bila semua sesi sudah ditutup", () => {
    const sessions = [
      { userId: "u1", checkIn: "2026-11-10T01:00:00Z", checkOut: "2026-11-10T03:00:00Z" },
    ];
    expect(openSessionFor(sessions, "u1")).toBeNull();
  });
});
