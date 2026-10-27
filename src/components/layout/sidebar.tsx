"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  CalendarDays,
  LineChart,
  Inbox,
  Bot,
  Clock,
  Sparkles,
} from "lucide-react";
import { useRole } from "@/contexts/role-context";
import { useAttendance } from "@/contexts/attendance-context";
import { useData } from "@/contexts/data-context";
import { BRANDING } from "@/lib/branding";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export function Sidebar({ onNavClick, className }: SidebarProps) {
  const pathname = usePathname();
  const { role, currentUser } = useRole();
  const { loanRequests, labReports } = useData();
  const { isCheckedIn, weeklyAccumulatedHours, weeklyTargetHours, formattedElapsed } =
    useAttendance();

  const isAdmin = role === "admin";

  // Hitung item menunggu tindakan untuk badge di menu Kotak Masuk / Permintaan Saya
  const pendingInboxCount = isAdmin
    ? loanRequests.filter((r) => r.status === "menunggu").length +
      labReports.filter((r) => r.status === "menunggu").length
    : loanRequests.filter(
        (r) =>
          (r.requesterId === currentUser.id || r.requesterNim === currentUser.nimOrNip) &&
          r.status === "menunggu"
      ).length;

  const navItems = [
    {
      name: BRANDING.nav.home,
      href: "/",
      icon: LayoutDashboard,
      roles: ["admin", "anggota", "advisor"],
    },
    {
      name: BRANDING.nav.inventory,
      href: "/inventaris",
      icon: Cpu,
      roles: ["admin", "anggota", "advisor"],
    },
    {
      name: BRANDING.nav.schedule,
      href: "/jadwal",
      icon: CalendarDays,
      roles: ["admin", "anggota", "advisor"],
    },
    {
      name: isAdmin ? BRANDING.nav.inboxAdmin : BRANDING.nav.inboxMember,
      href: "/kotak-masuk",
      icon: Inbox,
      roles: ["admin", "anggota", "advisor"],
      badge: pendingInboxCount > 0 ? pendingInboxCount : undefined,
    },
    {
      name: BRANDING.nav.monitoring,
      href: "/monitoring",
      icon: LineChart,
      roles: ["admin", "advisor"],
    },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role));
  const progressPercent = Math.min(
    100,
    Math.round((weeklyAccumulatedHours / weeklyTargetHours) * 100)
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-64 border-r border-slate-200 bg-white/95 backdrop-blur-md select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-500/20">
          <Bot className="h-6 w-6 stroke-[2]" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 text-base tracking-tight">
              {BRANDING.appName}
            </span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
              {BRANDING.campusShort}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">
            {BRANDING.scopeSubtitle}
          </span>
        </div>
      </div>

      {/* Navigasi Utama */}
      <div className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Menu Utama
        </div>
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group no-underline",
                isActive
                  ? "bg-emerald-50 text-emerald-700 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  isActive
                    ? "text-emerald-600 stroke-[2.2]"
                    : "text-slate-400 group-hover:text-slate-600 stroke-[1.75]"
                )}
              />
              <span className="truncate">{item.name}</span>

              {item.badge !== undefined && (
                <span
                  className={cn(
                    "ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  )}
                >
                  {item.badge}
                </span>
              )}

              {isActive && item.badge === undefined && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Widget Ringkas Absensi di Bawah Sidebar (Khusus Anggota) */}
      {role === "anggota" && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="rounded-xl border border-emerald-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Target Jam Lab</span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
                  isCheckedIn
                    ? "bg-emerald-100 text-emerald-800 animate-pulse"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {isCheckedIn ? "Aktif" : "Off"}
              </span>
            </div>

            {isCheckedIn && (
              <div className="mb-2 text-center py-1 bg-emerald-50/70 rounded-md border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                  Sesi Berjalan:
                </span>
                <p className="font-mono text-sm font-bold text-emerald-700">
                  {formattedElapsed}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>{weeklyAccumulatedHours} Jam</span>
                <span>Target: {weeklyTargetHours} Jam</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        </div>
      )}

      {/* Footer Info Sidebar */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 font-medium truncate">
          <Sparkles className="h-3 w-3 text-emerald-500 shrink-0" /> Ocean Breeze
        </span>
        <span className="font-semibold text-slate-500 shrink-0">{BRANDING.campusShort} 2025</span>
      </div>
    </aside>
  );
}
