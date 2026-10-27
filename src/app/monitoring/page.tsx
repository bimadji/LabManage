"use client";

import React, { useState } from "react";
import {
  LineChart as ChartIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Building,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useRole } from "@/contexts/role-context";
import { MOCK_TEAM_MONITORING } from "@/lib/mock-data";
import { BRANDING } from "@/lib/branding";
import { Banner } from "@/components/common/banner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/common/error-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MonitoringPage() {
  const { role } = useRole();
  const [activeGroupFilter, setActiveGroupFilter] = useState<"semua" | "tim_riset" | "ukm">("semua");

  // Proteksi Tampilan: Anggota TIDAK boleh mengakses halaman ini (RLS & UI protection)
  if (role === "anggota") {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorState
          title={`Akses Terbatas: Khusus Admin & Advisor`}
          message={`Halaman Monitoring Kehadiran Lab Robotika hanya dapat diakses oleh Kepala Laboratorium (Admin) atau Dosen Pembina (Advisor). Silakan gunakan Role Switcher di header jika Anda sedang menguji coba tampilan.`}
        />
      </div>
    );
  }

  // Pisahkan anggota Tim Riset (punya kewajiban jam lab) vs UKM Roboholic (tanpa target jam)
  const allMembers = MOCK_TEAM_MONITORING;
  const timRisetMembers = allMembers.filter((m) => m.teamType === "tim_riset");
  const ukmMembers = allMembers.filter((m) => m.teamType === "ukm");

  const displayedMembers =
    activeGroupFilter === "tim_riset"
      ? timRisetMembers
      : activeGroupFilter === "ukm"
      ? ukmMembers
      : allMembers;

  // Chart data khusus anggota yang memiliki target jam (tim_riset)
  const chartData = timRisetMembers.map((m) => ({
    name: m.name.split(" ")[0],
    fullName: m.name,
    team: m.team,
    jam: m.hoursThisWeek,
    target: m.targetHours || 10,
  }));

  const roomOccupancyData = [
    { name: "Arena Kontes Robot", value: 45, color: "#22c55e" },
    { name: "Lab Utama Robotika", value: 35, color: "#0ea5e9" },
    { name: "Bengkel & Fabrikasi Mekanik", value: 20, color: "#a855f7" },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Monitoring */}
      <Banner
        title="Monitoring Penggunaan Lab & Jam Riset"
        description="Pantau pemenuhan target wajib 10 jam/minggu anggota Tim Riset (EROS & EIRA), evaluasi utilisasi fasilitas bersama oleh UKM Roboholic, serta rekapitulasi kehadiran mahasiswa."
        badgeText={role === "admin" ? `Admin Lab Robotika PENS` : `Advisor Tim Robotika`}
        icon={<ChartIcon className="h-28 w-28" />}
      />

      {/* Filter Tab Kelompok */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
          Kategori Kelompok:
        </span>
        <button
          onClick={() => setActiveGroupFilter("semua")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            activeGroupFilter === "semua"
              ? "bg-slate-800 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Semua Kelompok ({allMembers.length} Anggota)
        </button>
        <button
          onClick={() => setActiveGroupFilter("tim_riset")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeGroupFilter === "tim_riset"
              ? "bg-emerald-700 text-white shadow-2xs"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          <Clock className="h-3 w-3" />
          Tim Riset (Wajib 10 Jam)
        </button>
        <button
          onClick={() => setActiveGroupFilter("ukm")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeGroupFilter === "ukm"
              ? "bg-purple-700 text-white shadow-2xs"
              : "bg-purple-50 text-purple-800 hover:bg-purple-100"
          }`}
        >
          <Users className="h-3 w-3" />
          UKM Roboholic (Bebas Jam)
        </button>
      </div>

      {/* Ringkasan Grafik Utama (Hanya Tampil Jika Tab Tim Riset / Semua Aktif) */}
      {activeGroupFilter !== "ukm" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Bar Chart: Jam Lab Mingguan terhadap Target 10 Jam */}
          <Card className="lg:col-span-2 border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800">
                Distribusi Jam Riset Anggota Tim Riset (Target: 10 Jam/Minggu)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Garis hijau menandakan batas minimal pemenuhan kewajiban mingguan anggota tim riset
              </p>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      domain={[0, 15]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                              <span className="font-bold text-slate-800 block">
                                {data.fullName}
                              </span>
                              <span className="text-slate-500 text-[10px] block mb-1">
                                {data.team}
                              </span>
                              <span className="text-emerald-600 font-semibold block">
                                Total Jam: {data.jam} Jam
                              </span>
                              <span className="text-slate-400 block text-[10px]">
                                Target: {data.target} Jam / Minggu
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={10}
                      stroke="#22c55e"
                      strokeDasharray="4 4"
                      label={{
                        value: "Target 10 Jam",
                        position: "right",
                        fill: "#15803d",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                    <Bar dataKey="jam" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Donut Chart: Okupansi Ruangan */}
          <Card className="border-slate-200 bg-white shadow-xs flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800">
                Tingkat Okupansi Fasilitas
              </CardTitle>
              <p className="text-xs text-slate-500">
                Persentase alokasi waktu ruang & arena bersama
              </p>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-center items-center pt-2">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roomOccupancyData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {roomOccupancyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full space-y-1.5 pt-2 border-t border-slate-100">
                {roomOccupancyData.map((room) => (
                  <div key={room.name} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: room.color }}
                      />
                      <span className="text-slate-700">{room.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{room.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabel Rekapitulasi Tim */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-base font-bold text-slate-800">
            Daftar Rekapitulasi Mahasiswa & Status Kehadiran
          </CardTitle>
          <p className="text-xs text-slate-500">
            Menampilkan {displayedMembers.length} anggota lab robotika
          </p>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Nama Anggota</th>
                <th className="px-5 py-3.5">Kelompok</th>
                <th className="px-5 py-3.5">Jenis Kelompok</th>
                <th className="px-5 py-3.5">Jam Minggu Ini</th>
                <th className="px-5 py-3.5">Capaian Target</th>
                <th className="px-5 py-3.5">Status Saat Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMembers.map((member) => {
                const isTimRiset = member.teamType === "tim_riset";
                const isMet = isTimRiset && member.hoursThisWeek >= (member.targetHours || 10);

                return (
                  <tr key={member.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {member.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {member.nim}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-700 font-semibold">
                      {member.team}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          isTimRiset
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {isTimRiset ? "Tim Riset" : "UKM"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                      {isTimRiset ? `${member.hoursThisWeek} Jam` : "-"}
                    </td>

                    <td className="px-5 py-3.5">
                      {!isTimRiset ? (
                        <span className="text-slate-400 text-[11px] italic">
                          Bebas Jam (UKM)
                        </span>
                      ) : isMet ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Tuntas ({Math.round((member.hoursThisWeek / (member.targetHours || 10)) * 100)}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold border border-amber-200">
                          <AlertCircle className="h-3 w-3" /> Kurang {((member.targetHours || 10) - member.hoursThisWeek).toFixed(1)} Jam
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          member.isCurrentlyInLab
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.isCurrentlyInLab ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                        />
                        {member.lastActive}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
