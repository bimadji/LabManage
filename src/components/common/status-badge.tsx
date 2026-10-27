"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ShieldCheck, Box } from "lucide-react";

export type StatusType =
  | "menunggu"
  | "disetujui"
  | "ditolak"
  | "rusak"
  | "tersedia"
  | "dipinjam"
  | "aktif"
  | "ditangani"
  | "selesai";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  label,
  className,
  showIcon = true,
}: StatusBadgeProps) {
  const getBadgeConfig = () => {
    switch (status) {
      case "menunggu":
        return {
          bg: "bg-amber-100",
          border: "border-amber-200",
          text: "text-amber-800",
          icon: <Clock className="h-3 w-3 text-amber-700" />,
          defaultLabel: "Menunggu",
        };
      case "disetujui":
      case "selesai":
        return {
          bg: "bg-emerald-100",
          border: "border-emerald-200",
          text: "text-emerald-800",
          icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" />,
          defaultLabel: status === "disetujui" ? "Disetujui" : "Selesai",
        };
      case "ditolak":
        return {
          bg: "bg-rose-100",
          border: "border-rose-200",
          text: "text-rose-800",
          icon: <XCircle className="h-3 w-3 text-rose-700" />,
          defaultLabel: "Ditolak",
        };
      case "rusak":
        return {
          bg: "bg-orange-100",
          border: "border-orange-200",
          text: "text-orange-800",
          icon: <AlertTriangle className="h-3 w-3 text-orange-700" />,
          defaultLabel: "Rusak",
        };
      case "tersedia":
        return {
          bg: "bg-sky-100",
          border: "border-sky-200",
          text: "text-sky-800",
          icon: <ShieldCheck className="h-3 w-3 text-sky-700" />,
          defaultLabel: "Tersedia",
        };
      case "dipinjam":
      case "ditangani":
      case "aktif":
        return {
          bg: "bg-purple-100",
          border: "border-purple-200",
          text: "text-purple-800",
          icon: <Box className="h-3 w-3 text-purple-700" />,
          defaultLabel:
            status === "dipinjam"
              ? "Dipinjam"
              : status === "ditangani"
              ? "Ditangani"
              : "Aktif",
        };
      default:
        return {
          bg: "bg-slate-100",
          border: "border-slate-200",
          text: "text-slate-800",
          icon: null,
          defaultLabel: status,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-2xs tracking-wide",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      {showIcon && config.icon}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}
