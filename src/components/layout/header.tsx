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
import { UserRole } from "@/types";
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
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Ganti Simulasi Peran
                </p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {currentUser.name}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {currentUser.nimOrNip}
                </p>
              </div>

              {(["anggota", "admin", "advisor"] as UserRole[]).map((r) => {
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setShowRoleMenu(false);
                    }}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors mb-1",
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{roleLabels[r].label}</span>
                        {isSelected && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            (Aktif)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {roleLabels[r].desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
