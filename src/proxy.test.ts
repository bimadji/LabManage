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

function mockSupabase(options: { user: { id: string } | null; role?: string }) {
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

describe("proxy — guard server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengalihkan ke /login bila belum login", async () => {
    mockSupabase({ user: null });
    const res = await proxy(makeRequest("/inventaris"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("membolehkan halaman login tanpa sesi", async () => {
    mockSupabase({ user: null });
    const res = await proxy(makeRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("membolehkan admin ke /monitoring", async () => {
    mockSupabase({ user: { id: "u1" }, role: "admin" });
    const res = await proxy(makeRequest("/monitoring"));
    expect(res.status).toBe(200);
  });

  it("mengalihkan anggota dari /monitoring ke beranda", async () => {
    mockSupabase({ user: { id: "u1" }, role: "anggota" });
    const res = await proxy(makeRequest("/monitoring"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/");
    expect(res.headers.get("location")).not.toContain("/monitoring");
  });

  it("membolehkan advisor ke /monitoring", async () => {
    mockSupabase({ user: { id: "u1" }, role: "advisor" });
    const res = await proxy(makeRequest("/monitoring"));
    expect(res.status).toBe(200);
  });
});
