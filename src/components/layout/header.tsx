"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  Plus,
  Box,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useRole } from "@/contexts/role-context";
import { useOverlay } from "@/contexts/overlay-context";
import { BRANDING } from "@/lib/branding";
import type { UserRole, User } from "@/types";
import { MOCK_USERS_LIST } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { role, currentUser, setRole } = useRole();
  const { openLoanSheet, openBookingDialog, openReportDialog } = useOverlay();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return BRANDING.titles.home;
      case "/inventaris":
        return BRANDING.titles.inventory;
      case "/jadwal":
        return BRANDING.titles.schedule;
      case "/kotak-masuk":
        return role === "admin"
          ? BRANDING.titles.inbox
          : BRANDING.titles.myRequests;
      case "/monitoring":
        return BRANDING.titles.monitoring;
      default:
        return BRANDING.appName;
    }
  };

  const roleLabels: Record<UserRole, { label: string; badge: string; desc: string }> = {
    anggota: {
      label: `Anggota ${BRANDING.userGroupSingular}`,
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      desc: "Akses peminjaman alat, absensi lab, & booking ruangan",
    },
    admin: {
      label: "Kepala Lab (Admin)",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      desc: "Verifikasi peminjaman, pengelolaan aset, & keluhan",
    },
    advisor: {
      label: "Dosen Pembina (Advisor)",
      badge: "bg-purple-100 text-purple-800 border-purple-200",
      desc: `Monitoring evaluasi jam lab, aktivitas ${BRANDING.userGroupLabel}, & riset`,
    },
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 md:px-6 backdrop-blur-md">
      {/* Kiri: Mobile Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>{BRANDING.breadcrumbRoot}</span>
            <span>/</span>
            <span className="text-emerald-600 font-semibold">{getPageTitle()}</span>
          </div>
          <h2 className="text-base font-bold text-slate-800 hidden sm:block">
            {getPageTitle()}
          </h2>
        </div>
      </div>

      {/* Kanan: Quick Actions, Role Switcher & Profil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Action Button Dropdown */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => {
              setShowQuickActions(!showQuickActions);
              setShowRoleMenu(false);
            }}
            className="hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs gap-1.5"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Aksi Cepat</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>

          {showQuickActions && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Aksi Cepat
              </div>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  openLoanSheet();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors text-left"
              >
                <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                  <Box className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-semibold">Pinjam Barang</div>
                  <div className="text-[10px] text-slate-400">Ajukan komponen riset / UKM</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  openBookingDialog();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-lg transition-colors text-left"
              >
                <div className="p-1 rounded-md bg-sky-100 text-sky-700">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-semibold">Pesan Ruang / Fasilitas</div>
                  <div className="text-[10px] text-slate-400">Jadwalkan uji coba atau rapat</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  openReportDialog();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors text-left"
              >
                <div className="p-1 rounded-md bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-semibold">Lapor Masalah / Stok</div>
                  <div className="text-[10px] text-slate-400">Komponen rusak atau habis</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Role Switcher Pill Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowRoleMenu(!showRoleMenu);
              setShowQuickActions(false);
            }}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left focus:outline-none"
          >
            <Avatar className="h-7 w-7 border-emerald-400">
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name.split(" ")[0]}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-tight">
                {roleLabels[role].label}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
              <div className="px-3 py-2 border-b border-slate-100 mb-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pengguna Aktif
                </p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {currentUser.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentUser.team} • <span className="font-mono">{currentUser.nimOrNip}</span>
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 uppercase tracking-wider">
                  Peran: {roleLabels[role].label} {currentUser.teamType === "ukm" ? "(UKM)" : "(Tim Riset)"}
                </p>
              </div>

              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Pilih Akun Simulasi & Kelompok
              </p>
              <div className="space-y-1">
                {/* Quick switcher to all simulated users */}
                <button
                  onClick={() => {
                    setRole("admin");
                    setShowRoleMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                    role === "admin" ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div>
                    <div className="font-semibold">Ahmad Zaki (Admin Lab)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Tim Riset EROS • NIP: 198503152010121001</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Admin</span>
                </button>

                <button
                  onClick={() => {
                    const erosUser = MOCK_USERS_LIST.find((u: User) => u.id === "usr-eros-01");
                    if (erosUser) {
                      setRole("anggota");
                    }
                    setShowRoleMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                    role === "anggota" && currentUser.team === "Tim Riset EROS" ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div>
                    <div className="font-semibold">Dimas Aditya (Tim Riset EROS)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Target: 10 Jam/Minggu • Absensi Aktif</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Riset</span>
                </button>

                <button
                  onClick={() => {
                    const roboUser = MOCK_USERS_LIST.find((u: User) => u.id === "usr-robo-01");
                    if (roboUser) {
                      setRole("anggota");
                      localStorage.setItem("labmanage_user_id", "usr-robo-01");
                      window.location.reload();
                    }
                    setShowRoleMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                    role === "anggota" && currentUser.team === "Roboholic" ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div>
                    <div className="font-semibold">Rina Kusuma (UKM Roboholic)</div>
                    <div className="text-[10px] text-slate-500 font-normal">UKM • Tanpa Absensi / Target Jam</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">UKM</span>
                </button>

                <button
                  onClick={() => {
                    setRole("advisor");
                    setShowRoleMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                    role === "advisor" ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div>
                    <div className="font-semibold">Dr. Ir. Budi Santoso (Advisor)</div>
                    <div className="text-[10px] text-slate-500 font-normal">Dosen Pembina • Tim Riset EROS</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Advisor</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
