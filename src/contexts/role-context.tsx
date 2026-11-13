"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, UserRole } from "@/types";
import { MOCK_USERS_LIST } from "@/lib/mock-data";
import { DEMO_MODE } from "@/lib/demo";
import { createClient } from "@/lib/supabase/client";

interface RoleContextType {
  role: UserRole;
  /** null bila belum login (di luar mode demo). */
  currentUser: User | null;
  isLoading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  /** Hanya mode demo: berpindah akun simulasi. */
  setDemoUser: (userId: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface ProfileRow {
  id: string;
  nama: string;
  nim: string;
  role: UserRole;
  avatar_url: string | null;
  email: string;
  kelompok_id: string;
  kelompok: {
    id: string;
    nama: string;
    jenis: "tim_riset" | "ukm";
    target_jam_mingguan: number | null;
  } | null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(
    DEMO_MODE ? MOCK_USERS_LIST[1] : null
  );
  const [isLoading, setIsLoading] = useState(!DEMO_MODE);

  const loadProfile = useCallback(async (userId: string): Promise<boolean> => {
    const supabase = createClient();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, nama, nim, role, avatar_url, email, kelompok_id, kelompok (id, nama, jenis, target_jam_mingguan)")
      .eq("id", userId)
      .single();

    if (error || !profiles) {
      setCurrentUser(null);
      return false;
    }

    const row = profiles as unknown as ProfileRow;
    const kelompok = row.kelompok;

    setCurrentUser({
      // id = profiles.id = auth.users.id = auth.uid() untuk sesi ini.
      id: row.id,
      name: row.nama,
      nimOrNip: row.nim,
      role: row.role,
      avatar:
        row.avatar_url ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
      email: row.email,
      team: kelompok?.nama ?? "Umum",
      teamId: kelompok?.id ?? row.kelompok_id,
      teamType: kelompok?.jenis,
      weeklyTargetHours: kelompok?.target_jam_mingguan ?? null,
    });
    return true;
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;

    const supabase = createClient();
    let active = true;

    async function resolveSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!active) return;
      if (!user) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }
      await loadProfile(user.id);
      if (active) setIsLoading(false);
    }

    void resolveSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }
      void loadProfile(session.user.id).then(() => {
        if (active) setIsLoading(false);
      });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    if (data.user) {
      const found = await loadProfile(data.user.id);
      if (!found) {
        // Login berhasil tapi akun belum didaftarkan admin lab.
        return {
          success: false,
          error:
            "Akunmu belum didaftarkan oleh admin lab. Hubungi Kepala Laboratorium Robotika PENS.",
        };
      }
    }
    return { success: true };
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const setDemoUser = (userId: string) => {
    if (!DEMO_MODE) return;
    const found = MOCK_USERS_LIST.find((u) => u.id === userId);
    if (found) setCurrentUser(found);
  };

  return (
    <RoleContext.Provider
      value={{
        role: currentUser?.role ?? "anggota",
        currentUser,
        isLoading,
        isDemoMode: DEMO_MODE,
        signIn,
        signOut,
        setDemoUser,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

/**
 * Pengguna yang pasti sudah login.
 * Komponen di bawah AppShell hanya dirender setelah currentUser ada,
 * jadi di sini aman untuk melempar error.
 */
export function useCurrentUser(): User {
  const { currentUser } = useRole();
  if (!currentUser) {
    throw new Error("useCurrentUser harus dipakai di dalam area yang butuh login");
  }
  return currentUser;
}
