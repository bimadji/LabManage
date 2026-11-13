import { describe, it, expect } from "vitest";
import { isLocalUrl } from "./test-harness";

describe("isLocalUrl — pengaman skrip yang menulis data", () => {
  it("menerima host lokal", () => {
    expect(isLocalUrl("http://127.0.0.1:54521")).toBe(true);
    expect(isLocalUrl("http://localhost:54321")).toBe(true);
    expect(isLocalUrl("http://[::1]:54321")).toBe(true);
  });

  it("menolak URL Supabase hosted (produksi)", () => {
    expect(isLocalUrl("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalUrl("https://abcdefgh.supabase.co/rest/v1")).toBe(false);
  });

  it("menolak URL lain yang bukan host lokal", () => {
    expect(isLocalUrl("https://contoh.example.com")).toBe(false);
    expect(isLocalUrl("https://127.0.0.1.evil.example.com")).toBe(false);
  });
});
