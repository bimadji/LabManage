"use client";

import React from "react";
import { Clock, Play, Square, RotateCcw, CheckCircle2 } from "lucide-react";
import { useAttendance } from "@/contexts/attendance-context";
import { BRANDING } from "@/lib/branding";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function AttendanceWidget() {
  const {
    isCheckedIn,
    checkInTime,
    weeklyAccumulatedHours,
    weeklyTargetHours,
    checkIn,
    checkOut,
    resetWeeklyDemo,
    formattedElapsed,
  } = useAttendance();

  const percentage = Math.min(
    100,
    Math.round((weeklyAccumulatedHours / weeklyTargetHours) * 100)
  );
  const remainingHours = Math.max(
    0,
    Number((weeklyTargetHours - weeklyAccumulatedHours).toFixed(1))
  );

  return (
    <Card className="border-emerald-200/60 shadow-xs relative overflow-hidden bg-white">
      {/* Aksen Gradasi Halus di Atas Card */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400" />

      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <Clock className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Absensi Kehadiran Lab
            </CardTitle>
            <p className="text-xs text-slate-500">
              Target Wajib: 10 Jam / Minggu ({BRANDING.scopeName})
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide",
            isCheckedIn
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isCheckedIn ? "bg-emerald-500 animate-ping" : "bg-slate-400"
            )}
          />
          {isCheckedIn ? "Sedang di Lab" : "Belum Check-In"}
        </span>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Counter Live Timer & Tombol Aksi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Durasi Sesi Aktif
            </span>
            <div className="font-mono text-3xl font-extrabold text-slate-800 tracking-tight flex items-baseline gap-2">
              <span>{isCheckedIn ? formattedElapsed : "00:00:00"}</span>
              {isCheckedIn && (
                <span className="text-xs font-sans text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Live Timer
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isCheckedIn && checkInTime
                ? `Mulai sejak: ${checkInTime.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} WIB`
                : "Klik tombol Check-In saat Anda mulai berkegiatan di lab"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isCheckedIn ? (
              <Button
                onClick={checkIn}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm gap-2 w-full sm:w-auto"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Check-In Sekarang</span>
              </Button>
            ) : (
              <Button
                onClick={checkOut}
                size="lg"
                variant="destructive"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm gap-2 w-full sm:w-auto"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Check-Out & Simpan</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progres Akumulasi Mingguan */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <span>Akumulasi Minggu Ini:</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {weeklyAccumulatedHours} Jam
              </span>
            </span>
            <span className="text-xs font-bold text-slate-600">{percentage}%</span>
          </div>

          <Progress value={percentage} className="h-3" />

          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>
              {remainingHours === 0 ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Target 10 jam tercapai!
                </span>
              ) : (
                `Sisa target: ${remainingHours} jam lagi`
              )}
            </span>
            <button
              onClick={resetWeeklyDemo}
              className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px] cursor-pointer"
              title="Reset progress untuk demonstrasi testing"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
