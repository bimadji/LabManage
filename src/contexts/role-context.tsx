"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { MOCK_USERS } from "@/lib/mock-data";

interface RoleContextType {
  role: UserRole;
  currentUser: User;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("anggota");

  useEffect(() => {
    const saved = localStorage.getItem("labmanage_role") as UserRole;
    if (saved && (saved === "admin" || saved === "anggota" || saved === "advisor")) {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem("labmanage_role", newRole);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        currentUser: MOCK_USERS[role],
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
