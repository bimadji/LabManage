import { cache } from "react";
import { createClient } from "./server";
import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;
  name: string;
  nim: string;
  role: UserRole;
  kelompokId: string;
  kelompokNama: string | null;
  kelompokJenis: "tim_riset" | "ukm" | null;
}

interface ProfileRow {
  id: string;
  nama: string;
  nim: string;
  role: UserRole;
  kelompok_id: string;
  kelompok: { id: string; nama: string; jenis: "tim_riset" | "ukm" } | null;
}

/**
 * Sumber kebenaran sisi server untuk identitas & peran.
 * Selalu pakai auth.getUser() (validasi JWT di server), bukan session dari cookie tanpa cek.
 * null = belum login atau profil tidak ada.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nama, nim, role, kelompok_id, kelompok (id, nama, jenis)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const row = profile as unknown as ProfileRow;
  const kelompok = row.kelompok;

  return {
    id: row.id,
    name: row.nama,
    nim: row.nim,
    role: row.role,
    kelompokId: kelompok?.id ?? row.kelompok_id,
    kelompokNama: kelompok?.nama ?? null,
    kelompokJenis: kelompok?.jenis ?? null,
  };
});
