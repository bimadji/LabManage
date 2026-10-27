"use client";

import React, { useState } from "react";
import {
  Inbox,
  Filter,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useRole } from "@/contexts/role-context";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { BRANDING } from "@/lib/branding";
import { Banner } from "@/components/common/banner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, StatusType } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoanRequest, LabReport } from "@/types";

interface DisplayItem {
  type: "permohonan" | "laporan";
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  authorSub: string;
  authorAvatar: string;
  date: string;
  extra: string;
  status: StatusType;
  loanData?: LoanRequest;
  reportData?: LabReport;
}

export default function KotakMasukPage() {
  const { role, currentUser } = useRole();
  const { loanRequests, labReports } = useData();
  const { openReviewSheet, openReportReviewSheet, openLoanSheet, openReportDialog } =
    useOverlay();

  const [activeTab, setActiveTab] = useState<"semua" | "permohonan" | "laporan">("semua");
  const [statusFilter, setStatusFilter] = useState<string>("semua");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const isAdmin = role === "admin";

  const loanItems: DisplayItem[] = loanRequests
    .filter((req) => {
      if (isAdmin) return true;
      return (
        req.requesterId === currentUser.id ||
        req.requesterNim === currentUser.nimOrNip
      );
    })
    .map((item) => ({
      type: "permohonan",
      id: item.id,
      title: `${item.quantity}x ${item.itemName}`,
      subtitle: item.projectPurpose,
      authorName: item.requesterName,
      authorSub: `${item.requesterNim} • ${BRANDING.userGroupSingular}`,
      authorAvatar: item.requesterAvatar,
      date: item.requestDate,
      extra: `Kembali: ${item.expectedReturnDate}`,
      status: item.status as StatusType,
      loanData: item,
    }));

  const reportItems: DisplayItem[] = labReports
    .filter((rep) => {
      if (isAdmin) return true;
      return rep.reporterName.toLowerCase().includes(currentUser.name.toLowerCase().split(" ")[0]);
    })
    .map((item) => ({
      type: "laporan",
      id: item.id,
      title: item.title,
      subtitle: item.description,
      authorName: item.reporterName,
      authorSub: `Lokasi: ${item.location}`,
      authorAvatar: "",
      date: item.createdAt,
      extra: `Urgensi: ${item.urgency}`,
      status: item.status as StatusType,
      reportData: item,
    }));

  const allItems: DisplayItem[] = [...loanItems, ...reportItems].sort((a, b) =>
    b.id.localeCompare(a.id)
  );

  const displayedItems = allItems.filter((item) => {
    const matchTab =
      activeTab === "semua" ||
      (activeTab === "permohonan" && item.type === "permohonan") ||
      (activeTab === "laporan" && item.type === "laporan");

    const matchStatus =
      statusFilter === "semua" ||
      (statusFilter === "menunggu" && item.status === "menunggu") ||
      (statusFilter === "disetujui" &&
        (item.status === "disetujui" || item.status === "ditangani" || item.status === "selesai")) ||
      (statusFilter === "ditolak" && item.status === "ditolak");

    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.authorName.toLowerCase().includes(q);

    return matchTab && matchStatus && matchQuery;
  });

  const pendingCount = allItems.filter((i) => i.status === "menunggu").length;

  return (
    <div className="space-y-6">
      <Banner
        title={isAdmin ? BRANDING.titles.inbox : BRANDING.titles.myRequests}
        description={
          isAdmin
            ? `Pusat verifikasi terpadu untuk permohonan pinjam alat serta penanganan laporan kendala inventaris di ${BRANDING.scopeName}.`
            : `Pantau status persetujuan peminjaman komponen dan laporan masalah yang Anda ajukan di ${BRANDING.scopeName}.`
        }
        badgeText={isAdmin ? "Panel Verifikasi Kepala Lab" : `Status Permintaan ${BRANDING.userGroupSingular}`}
        action={
          !isAdmin ? (
            <div className="flex gap-2">
              <Button
                onClick={() => openLoanSheet()}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Pinjam Alat
              </Button>
              <Button
                onClick={() => openReportDialog()}
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white"
              >
                Lapor Masalah
              </Button>
            </div>
          ) : undefined
        }
        icon={<Inbox className="h-28 w-28" />}
      />

      {/* Toolbar: Tabs, Filter Status, dan Pencarian */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "semua" | "permohonan" | "laporan")}
          className="w-auto"
        >
          <TabsList className="bg-slate-100">
            <TabsTrigger value="semua" className="text-xs">
              Semua ({allItems.length})
            </TabsTrigger>
            <TabsTrigger value="permohonan" className="text-xs">
              Permohonan ({loanItems.length})
            </TabsTrigger>
            <TabsTrigger value="laporan" className="text-xs">
              Laporan ({reportItems.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-2xs focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="semua">Semua Status</option>
            <option value="menunggu">Menunggu Tindakan ({pendingCount})</option>
            <option value="disetujui">Disetujui / Selesai</option>
            <option value="ditolak">Ditolak</option>
          </select>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari item atau pemohon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Daftar Item */}
      {displayedItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Tidak Ada Item Ditemukan"
          description="Tidak ada permohonan atau laporan yang cocok dengan kriteria filter saat ini."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab("semua");
                setStatusFilter("semua");
                setSearchQuery("");
              }}
            >
              Reset Filter
            </Button>
          }
          className="bg-white py-12"
        />
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {item.type === "permohonan" ? (
                  <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                    <AvatarImage src={item.authorAvatar} alt={item.authorName} />
                    <AvatarFallback>{item.authorName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                )}

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        item.type === "permohonan"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {item.type === "permohonan" ? "Permohonan Pinjam" : "Laporan Kendala"}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {item.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span>Oleh: <strong className="text-slate-700">{item.authorName}</strong></span>
                    <span>• {item.authorSub}</span>
                    <span>• Diajukan: {item.date}</span>
                    <span className="text-emerald-700 font-medium">• {item.extra}</span>
                  </div>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {item.type === "permohonan" && item.loanData ? (
                  <Button
                    size="sm"
                    onClick={() => openReviewSheet(item.loanData!)}
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isAdmin ? "Tinjau Permohonan" : "Lihat Rincian"}
                  </Button>
                ) : item.reportData ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReportReviewSheet(item.reportData!)}
                    className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Detail Laporan
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
