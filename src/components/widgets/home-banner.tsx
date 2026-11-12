"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Award } from "lucide-react";
import { useCurrentUser, useRole } from "@/contexts/role-context";
import { useOverlay } from "@/contexts/overlay-context";
import { BRANDING } from "@/lib/branding";
import { Banner } from "@/components/common/banner";
import { Button } from "@/components/ui/button";

export function HomeBanner() {
  const { role } = useRole();
  const currentUser = useCurrentUser();
  const { openLoanSheet, openBookingDialog } = useOverlay();
  const [greeting, setGreeting] = useState("Selamat Datang");

  useEffect(() => {
    // Ditunda ke frame berikutnya: jam berjalan tidak boleh dihitung saat render server.
    const id = setTimeout(() => {
      const hours = new Date().getHours();
      if (hours < 11) setGreeting("Selamat Pagi");
      else if (hours < 15) setGreeting("Selamat Siang");
      else if (hours < 18) setGreeting("Selamat Sore");
      else setGreeting("Selamat Malam");
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const getBannerContent = () => {
    switch (role) {
      case "admin":
        return {
          title: `${greeting}, Pak ${currentUser.name.split(" ")[0]}!`,
          desc: `Pusat kendali operasional ${BRANDING.scopeName}. Verifikasi pengajuan pinjaman komponen, pantau inventaris mikrokontroler & sensor, serta tindak lanjuti laporan laboratorium dan fasilitas UKM.`,
          badge: "Mode Kepala Laboratorium",
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="default"
                onClick={() => openBookingDialog()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                Atur Jadwal Ruang / Arena
              </Button>
            </div>
          ),
          icon: <ShieldCheck className="h-28 w-28" />,
        };
      case "advisor":
        return {
          title: `${greeting}, ${currentUser.name}!`,
          desc: `Panel pembina ${BRANDING.userGroupLabel} PENS. Tinjau produktivitas riset divisi, pemenuhan target akumulasi jam lab mahasiswa, dan pemanfaatan fasilitas arena serta ruang kerja UKM.`,
          badge: `Mode Dosen Pembina (${BRANDING.userGroupLabel})`,
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="default"
                variant="outline"
                onClick={() => (window.location.href = "/monitoring")}
                className="bg-white/90 text-slate-800 border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <span>Buka Monitoring {BRANDING.userGroupLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ),
          icon: <Award className="h-28 w-28" />,
        };
      case "anggota":
      default:
        return {
          title: `${greeting}, ${currentUser.name.split(" ")[0]}!`,
          desc: `Siap melanjutkan riset di ${currentUser.team}? Pastikan check-in saat tiba di lab untuk mencatat target 10 jam/minggu dan gunakan fitur peminjaman mandiri fasilitas ${BRANDING.scopeName}.`,
          badge: `Anggota ${BRANDING.userGroupLabel} PENS`,
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="default"
                onClick={() => openLoanSheet()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                Ajukan Pinjam Alat
              </Button>
              <Button
                size="default"
                variant="outline"
                onClick={() => openBookingDialog()}
                className="bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50"
              >
                Pesan Ruangan
              </Button>
            </div>
          ),
          icon: <Sparkles className="h-28 w-28" />,
        };
    }
  };

  const content = getBannerContent();

  return (
    <Banner
      title={content.title}
      description={content.desc}
      badgeText={content.badge}
      action={content.action}
      icon={content.icon}
      className="mb-6"
    />
  );
}
