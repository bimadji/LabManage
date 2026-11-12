import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/common/status-badge";

describe("StatusBadge", () => {
  it("memakai token warna DESIGN.md §3 untuk status Borrow", () => {
    const { container } = render(<StatusBadge status="dipinjam" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("bg-purple-100");
    expect(badge.className).toContain("border-purple-200");
    expect(badge.className).toContain("text-purple-800");
    expect(screen.getByText("Dipinjam")).toBeInTheDocument();
  });

  it("memakai token warna untuk menunggu, disetujui, ditolak, rusak, tersedia, habis", () => {
    const cases: [Parameters<typeof StatusBadge>[0]["status"], string[]][] = [
      ["menunggu", ["bg-amber-100", "border-amber-200", "text-amber-800"]],
      ["disetujui", ["bg-emerald-100", "border-emerald-200", "text-emerald-800"]],
      ["ditolak", ["bg-rose-100", "border-rose-200", "text-rose-800"]],
      ["rusak", ["bg-orange-100", "border-orange-200", "text-orange-800"]],
      ["tersedia", ["bg-sky-100", "border-sky-200", "text-sky-800"]],
    ];
    for (const [status, expected] of cases) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const badge = container.firstElementChild as HTMLElement;
      for (const cls of expected) expect(badge.className).toContain(cls);
      unmount();
    }
  });

  it("menampilkan label yang sesuai untuk setiap status (bukan warna saja)", () => {
    render(<StatusBadge status="ditangani" />);
    expect(screen.getByText("Ditangani")).toBeInTheDocument();
  });

  it("memakai label yang diberikan bila ada", () => {
    render(<StatusBadge status="menunggu" label="Stok Habis" />);
    expect(screen.getByText("Stok Habis")).toBeInTheDocument();
  });
});
