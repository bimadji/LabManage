"use client";

import React from "react";
import { useRole } from "@/contexts/role-context";
import { HomeBanner } from "@/components/widgets/home-banner";
import { AttendanceWidget } from "@/components/widgets/attendance-widget";
import { MyLoansWidget } from "@/components/widgets/my-loans-widget";
import { AdminInboxWidget } from "@/components/widgets/admin-inbox-widget";
import { ScheduleWidget } from "@/components/widgets/schedule-widget";
import { InventoryWidget } from "@/components/widgets/inventory-widget";
import { TeamOverviewWidget } from "@/components/widgets/team-overview-widget";

export default function HomePage() {
  const { role } = useRole();

  return (
    <div className="space-y-6">
      {/* Banner Sapaan Kontekstual Peran */}
      <HomeBanner />

      {/* Grid Dashboard Sesuai Matriks Peran: items-start agar kartu tidak ditarik setinggi tetangganya */}
      {role === "anggota" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Kolom Kiri */}
          <div className="space-y-6">
            <AttendanceWidget />
            <ScheduleWidget />
          </div>

          {/* Kolom Kanan: Permintaan / Pinjaman Saya & Inventaris Cepat */}
          <div className="space-y-6">
            <MyLoansWidget />
            <InventoryWidget />
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Kolom Kiri: Kotak Masuk Verifikasi & Ringkasan Tim */}
          <div className="space-y-6">
            <AdminInboxWidget />
            <TeamOverviewWidget />
          </div>

          {/* Kolom Kanan: Jadwal Ruangan & Inventaris Cepat */}
          <div className="space-y-6">
            <ScheduleWidget />
            <InventoryWidget />
          </div>
        </div>
      )}

      {role === "advisor" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Kolom Kiri: Ringkasan Tim & Jadwal Ruangan */}
          <div className="space-y-6">
            <TeamOverviewWidget />
            <ScheduleWidget />
          </div>

          {/* Kolom Kanan: Permintaan Saya & Inventaris */}
          <div className="space-y-6">
            <MyLoansWidget />
            <InventoryWidget />
          </div>
        </div>
      )}
    </div>
  );
}
