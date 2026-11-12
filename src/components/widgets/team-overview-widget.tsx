"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { createClient } from "@/lib/supabase/client";
import { getWeekRange, hoursForUser } from "@/lib/attendance";
import { BRANDING } from "@/lib/branding";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileRow {
  id: string;
  nama: string;
  nim: string;
  role: "admin" | "anggota" | "advisor";
  avatar_url: string | null;
  kelompok: { id: string; nama: string; jenis: "tim_riset" | "ukm"; target_jam_mingguan: number | null } | null;
}

export function TeamOverviewWidget() {
  const { attendanceSessions } = useData();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadMembers() {
      const { data } = await supabase
        .from("profiles")
        .select("id, nama, nim, role, avatar_url, kelompok (id, nama, jenis, target_jam_mingguan)");
      if (!active) return;
      setProfiles((data ?? []) as unknown as ProfileRow[]);
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, []);

  const { start, end } = useMemo(() => getWeekRange(), []);

  const members = useMemo(
    () =>
      profiles
        .filter((p) => p.role === "anggota")
        .map((p) => ({
          userId: p.id,
          name: p.nama,
          nim: p.nim,
          team: p.kelompok?.nama ?? "-",
          teamType: p.kelompok?.jenis ?? "tim_riset",
          avatar: p.avatar_url ?? "",
          targetHours: p.kelompok?.target_jam_mingguan ?? null,
          hoursThisWeek: hoursForUser(attendanceSessions, p.id, start, end),
          isCurrentlyInLab: attendanceSessions.some((s) => s.userId === p.id && !s.checkOut),
        })),
    [profiles, attendanceSessions, start, end]
  );

  const inLabCount = members.filter((m) => m.isCurrentlyInLab).length;
  const targetCompletedCount = members.filter(
    (m) => m.targetHours !== null && m.hoursThisWeek >= m.targetHours
  ).length;

  const avgHours = members.length
    ? (members.reduce((acc, m) => acc + m.hoursThisWeek, 0) / members.length).toFixed(1)
    : "-";

  return (
    <Card className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
            <Users className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Ringkasan {BRANDING.userGroupLabel}
            </CardTitle>
            <p className="text-xs text-slate-500">
              Metrik kehadiran & jam riset minggu berjalan
            </p>
          </div>
        </div>

        <Link
          href="/monitoring"
          className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 no-underline min-h-11"
        >
          Lihat Detail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Metrik Mini Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-0.5">
              Di Lab Saat Ini
            </span>
            <span className="text-xl font-extrabold text-emerald-800 font-mono">
              {inLabCount} / {members.length}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block mb-0.5">
              Rata-Rata Jam
            </span>
            <span className="text-xl font-extrabold text-sky-800 font-mono">
              {avgHours} Jam
            </span>
          </div>

          <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-0.5">
              Target Tuntas
            </span>
            <span className="text-xl font-extrabold text-purple-800 font-mono">
              {targetCompletedCount} Mhs
            </span>
          </div>
        </div>

        {/* Cuplikan Mahasiswa yang Sedang di Lab */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Anggota Aktif di Lab
          </span>
          <div className="space-y-1.5">
            {members.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-[11px] text-slate-500">
                Belum ada data kehadiran anggota.
              </p>
            )}
            {members.slice(0, 4).map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {member.name}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {member.team}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    {member.targetHours !== null ? `${member.hoursThisWeek} / ${member.targetHours} Jam` : "UKM (Bebas Jam)"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {member.isCurrentlyInLab ? "Sedang di Lab" : "Offline"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
