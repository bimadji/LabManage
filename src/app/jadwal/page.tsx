"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  Plus,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { BRANDING } from "@/lib/branding";
import { Banner } from "@/components/common/banner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JadwalPage() {
  const { roomBookings } = useData();
  const { openBookingDialog } = useOverlay();

  const [filterRoom, setFilterRoom] = useState<string>("semua");

  const roomsList = [
    {
      id: "ARENA-01",
      name: "Arena Uji Coba KRAI / KRI",
      capacity: 25,
      desc: "Lapangan karpet standar kontes robot nasional untuk manuver & uji sensor.",
      color: "border-emerald-200 bg-emerald-50/40",
    },
    {
      id: "FAB-02",
      name: "Ruang Mekanik & Fabrikasi",
      capacity: 15,
      desc: "Area mesin bubut, gerinda, CNC router, perakitan mekanik, dan perkakas potong.",
      color: "border-sky-200 bg-sky-50/40",
    },
    {
      id: "SOFT-03",
      name: "Ruang Diskusi & Software UKM",
      capacity: 20,
      desc: "Ruang ber-AC dengan layar proyektor, meja workstation, dan switch LAN gigabit.",
      color: "border-purple-200 bg-purple-50/40",
    },
  ];

  const filteredBookings = roomBookings.filter(
    (bkg) => filterRoom === "semua" || bkg.roomName.includes(filterRoom)
  );

  return (
    <div className="space-y-6">
      {/* Banner Jadwal */}
      <Banner
        title={BRANDING.titles.schedule}
        description={`Pantau slot penggunaan arena robotika dan area kerja ${BRANDING.scopeName}. Reservasi slot kegiatan agar simulasi robot dan kegiatan UKM tidak tumpang tindih.`}
        badgeText={`Fasilitas ${BRANDING.scopeName}`}
        action={
          <Button
            onClick={() => openBookingDialog()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Pesan Jadwal Baru</span>
          </Button>
        }
        icon={<CalendarDays className="h-28 w-28" />}
      />

      {/* Ringkasan 3 Ruangan Utama */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roomsList.map((room) => (
          <div
            key={room.id}
            className={`p-4 rounded-xl border ${room.color} bg-white shadow-2xs space-y-2`}
          >
            <div className="flex justify-between items-start">
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                {room.id}
              </span>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Users className="h-3 w-3" /> Kapasitas {room.capacity}
              </span>
            </div>
            <h3 className="font-bold text-sm text-slate-800">{room.name}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {room.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Filter & Daftar Booking Agenda */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Agenda & Reservasi Fasilitas
            </CardTitle>
            <p className="text-xs text-slate-500">
              Daftar kegiatan {BRANDING.userGroupLabel} yang telah terkonfirmasi
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="semua">Semua Ruangan</option>
              <option value="Arena">Arena Uji Coba</option>
              <option value="Mekanik">Ruang Fabrikasi</option>
              <option value="Diskusi">Ruang Diskusi & Software</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {filteredBookings.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Belum ada reservasi aktif pada ruangan ini.
            </p>
          ) : (
            filteredBookings.map((bkg) => (
              <div
                key={bkg.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">
                      {bkg.roomName}
                    </span>
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                      {bkg.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    {bkg.purpose}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1.5 font-mono text-emerald-700 font-semibold">
                      <Clock className="h-3.5 w-3.5" /> {bkg.timeSlot}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> PIC: {bkg.picName} ({bkg.picNim})
                    </span>
                    <span className="text-slate-400">
                      • {bkg.participantsCount} Peserta ({BRANDING.userGroupSingular})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Terjadwal
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
