import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "@/proxy";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function makeRequest(pathname: string) {
  return {
    nextUrl: { pathname, searchParams: new URLSearchParams() },
    url: `http://localhost:3000${pathname}`,
  } as unknown as Parameters<typeof proxy>[0];
}

/** Sesi dengan profil ber-peran; role null berarti user tanpa baris profiles. */
function mockSupabase(options: { user: { id: string } | null; role?: string | null }) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: options.user } });
  const from = vi.fn().mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: options.role ? { role: options.role } : null }),
      }),
    }),
  });
  mockedCreateClient.mockResolvedValue({ auth: { getUser }, from } as never);
}

const RUTE_TANPA_LOGIN = ["/", "/inventaris", "/jadwal", "/kotak-masuk", "/monitoring"];
const RUTE_ADMIN_ADVISOR = ["/monitoring"];

describe("proxy — guard server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tanpa sesi", () => {
    for (const rute of RUTE_TANPA_LOGIN) {
      it(`${rute} dialihkan ke /login`, async () => {
        mockSupabase({ user: null });
        const res = await proxy(makeRequest(rute));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/login");
      });
    }

    it("halaman login boleh tanpa sesi", async () => {
      mockSupabase({ user: null });
      const res = await proxy(makeRequest("/login"));
      expect(res.status).toBe(200);
    });
  });

  describe("user tanpa baris profiles", () => {
    for (const rute of RUTE_TANPA_LOGIN) {
      it(`${rute} dialihkan ke /login`, async () => {
        mockSupabase({ user: { id: "u-tanpa-profil" }, role: null });
        const res = await proxy(makeRequest(rute));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/login");
      });
    }
  });

  describe("peran dengan profil", () => {
    for (const peran of ["admin", "advisor"] as const) {
      for (const rute of RUTE_ADMIN_ADVISOR) {
        it(`${peran} boleh membuka ${rute}`, async () => {
          mockSupabase({ user: { id: "u1" }, role: peran });
          const res = await proxy(makeRequest(rute));
          expect(res.status).toBe(200);
        });
      }
    }

    for (const peran of ["anggota", "advisor"] as const) {
      it(`${peran} boleh membuka halaman biasa`, async () => {
        mockSupabase({ user: { id: "u1" }, role: peran });
        for (const rute of ["/", "/inventaris", "/jadwal", "/kotak-masuk"]) {
          const res = await proxy(makeRequest(rute));
          expect(res.status).toBe(200);
        }
      });
    }

    it("anggota dialihkan dari /monitoring ke beranda", async () => {
      mockSupabase({ user: { id: "u1" }, role: "anggota" });
      const res = await proxy(makeRequest("/monitoring"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/");
      expect(res.headers.get("location")).not.toContain("/monitoring");
    });
  });
});
