"use client";

import React from "react";
import Link from "next/link";
import {
  Inbox,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { BRANDING } from "@/lib/branding";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AdminInboxWidget() {
  const { loanRequests, labReports } = useData();
  const { openReviewSheet, openReportReviewSheet } = useOverlay();

  // Permintaan peminjaman & laporan yang menunggu tindakan
  const pendingRequests = loanRequests.filter((r) => r.status === "menunggu");
  const pendingReports = labReports.filter((rep) => rep.status === "menunggu");

  // Gabungkan semua item yang menunggu tindakan
  type MixedPendingItem =
    | { kind: "loan"; id: string; data: (typeof loanRequests)[number] }
    | { kind: "report"; id: string; data: (typeof labReports)[number] };

  const allPending: MixedPendingItem[] = [
    ...pendingRequests.map((r) => ({ kind: "loan" as const, id: r.id, data: r })),
    ...pendingReports.map((rep) => ({ kind: "report" as const, id: rep.id, data: rep })),
  ];

  const totalWaiting = allPending.length;
  // Ambil maksimal 4 item teratas agar kartu ringkas dan tinggi mengikuti isi
  const topPending = allPending.slice(0, 4);

  return (
    <Card className="border-blue-200/80 shadow-xs bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <Inbox className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Kotak Masuk Verifikasi Lab
            </CardTitle>
            <p className="text-xs text-slate-500">
              {pendingRequests.length} permohonan pinjam & {pendingReports.length} laporan tertunda
            </p>
          </div>
        </div>

        <Link
          href="/kotak-masuk"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 no-underline"
        >
          Lihat semua ({totalWaiting}) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        {totalWaiting === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-lg">
            Semua permohonan pinjam dan laporan telah ditindaklanjuti.
          </p>
        ) : (
          topPending.map((item) => {
            if (item.kind === "loan") {
              const req = item.data;
              return (
                <div
                  key={`loan-${req.id}`}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="h-9 w-9 mt-0.5 shrink-0">
                      <AvatarImage src={req.requesterAvatar} alt={req.requesterName} />
                      <AvatarFallback>{req.requesterName.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {req.requesterName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {req.requesterNim}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 shrink-0">
                          Pinjam
                        </span>
                      </div>
                      <p className="text-xs font-medium text-emerald-800 truncate">
                        {req.quantity}x {req.itemName}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {req.projectPurpose}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      size="sm"
                      onClick={() => openReviewSheet(req)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold"
                    >
                      Tinjau
                    </Button>
                  </div>
                </div>
              );
            } else {
              const rep = item.data;
              return (
                <div
                  key={`report-${rep.id}`}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5 text-rose-600">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {rep.title}
                        </span>
                        <StatusBadge
                          status={rep.type === "rusak" ? "rusak" : "menunggu"}
                          label={rep.type === "rusak" ? "Alat Rusak" : "Stok Habis"}
                          showIcon={false}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        Lokasi: {rep.location} • Pelapor: {rep.reporterName}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReportReviewSheet(rep)}
                    className="text-xs h-8 text-slate-700 shrink-0 self-end sm:self-center border-slate-200 hover:bg-white"
                  >
                    Detail
                  </Button>
                </div>
              );
            }
          })
        )}
      </CardContent>
    </Card>
  );
}
