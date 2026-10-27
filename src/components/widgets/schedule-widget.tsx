"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, Plus, Clock, Users, ArrowRight } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ScheduleWidget() {
  const { roomBookings } = useData();
  const { openBookingDialog } = useOverlay();

  // Tampilkan hanya sesi terdekat: hari ini dan besok
  const nearBookings = roomBookings.filter(
    (b) => b.date === "Hari Ini" || b.date === "Besok"
  );

  return (
    <Card className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <CalendarDays className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Jadwal Ruangan & Arena Lab
            </CardTitle>
            <p className="text-xs text-slate-500">
              Sesi penggunaan terdekat (Hari ini & Besok)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/jadwal"
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 hidden sm:flex items-center gap-1 no-underline"
          >
            Lihat semua ({roomBookings.length}) <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openBookingDialog()}
            className="h-8 gap-1 text-xs border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Pesan Slot</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-1 space-y-3">
        {nearBookings.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-lg">
            Tidak ada reservasi terdekat untuk hari ini atau besok.
          </p>
        ) : (
          nearBookings.map((bkg) => (
            <div
              key={bkg.id}
              className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-sm text-slate-800 block">
                    {bkg.roomName}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {bkg.purpose}
                  </span>
                </div>
                <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 shrink-0">
                  {bkg.date}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                <span className="flex items-center gap-1 font-mono text-slate-700 font-medium">
                  <Clock className="h-3 w-3 text-slate-400" /> {bkg.timeSlot}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-slate-400" /> PIC: {bkg.picName} ({bkg.participantsCount} orang)
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
