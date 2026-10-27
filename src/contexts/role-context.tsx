"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { MOCK_USERS_LIST } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

interface RoleContextType {
  role: UserRole;
  currentUser: User;
  availableUsers: User[];
  setCurrentUserById: (userId: string) => void;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User>(MOCK_USERS_LIST[1]); // Dimas Aditya (EROS, Anggota)
  const [role, setRoleState] = useState<UserRole>("anggota");
  const [availableUsers, setAvailableUsers] = useState<User[]>(MOCK_USERS_LIST);

  // Sync with Supabase Auth or Profiles if available
  useEffect(() => {
    const supabase = createClient();
    async function loadProfiles() {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, nama, nim, role, avatar_url, email, kelompok_id, kelompok (id, nama, jenis, target_jam_mingguan)");

        if (!error && profiles && profiles.length > 0) {
          const mapped: User[] = profiles.map((p: any) => ({
            id: p.id,
            name: p.nama,
            nimOrNip: p.nim,
            role: p.role,
            avatar: p.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
            email: p.email,
            team: p.kelompok?.nama || "Umum",
            teamId: p.kelompok?.id,
            teamType: p.kelompok?.jenis,
            weeklyTargetHours: p.kelompok?.target_jam_mingguan,
          }));
          setAvailableUsers(mapped);
          // If we had a stored user
          const savedUserId = localStorage.getItem("labmanage_user_id");
          const found = mapped.find((u) => u.id === savedUserId);
          if (found) {
            setCurrentUserState(found);
            setRoleState(found.role);
          }
        }
      } catch {
        // Fallback to mock data
      }
    }

    loadProfiles();
  }, []);

  useEffect(() => {
    const savedUserId = localStorage.getItem("labmanage_user_id");
    if (savedUserId) {
      const found = availableUsers.find((u) => u.id === savedUserId);
      if (found) {
        setCurrentUserState(found);
        setRoleState(found.role);
        return;
      }
    }

    const savedRole = localStorage.getItem("labmanage_role") as UserRole;
    if (savedRole && (savedRole === "admin" || savedRole === "anggota" || savedRole === "advisor")) {
      const match = availableUsers.find((u) => u.role === savedRole);
      if (match) {
        setCurrentUserState(match);
        setRoleState(savedRole);
      }
    }
  }, [availableUsers]);

  const setCurrentUserById = (userId: string) => {
    const found = availableUsers.find((u) => u.id === userId);
    if (found) {
      setCurrentUserState(found);
      setRoleState(found.role);
      localStorage.setItem("labmanage_user_id", found.id);
      localStorage.setItem("labmanage_role", found.role);
    }
  };

  const setRole = (newRole: UserRole) => {
    const match = availableUsers.find((u) => u.role === newRole);
    if (match) {
      setCurrentUserState(match);
      setRoleState(newRole);
      localStorage.setItem("labmanage_user_id", match.id);
      localStorage.setItem("labmanage_role", newRole);
    } else {
      setRoleState(newRole);
      localStorage.setItem("labmanage_role", newRole);
    }
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        currentUser,
        availableUsers,
        setCurrentUserById,
        setRole,
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
