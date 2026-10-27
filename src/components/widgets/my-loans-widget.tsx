"use client";

import React from "react";
import Link from "next/link";
import { Box, Plus, Calendar, ArrowRight } from "lucide-react";
import { useRole } from "@/contexts/role-context";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";

export function MyLoansWidget() {
  const { currentUser } = useRole();
  const { loanRequests } = useData();
  const { openLoanSheet } = useOverlay();

  // Filter pinjaman milik pengguna aktif
  const myLoans = loanRequests.filter(
    (req) => req.requesterId === currentUser.id || req.requesterNim === currentUser.nimOrNip
  );

  return (
    <Card className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
            <Box className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Pinjaman Alat Saya
            </CardTitle>
            <p className="text-xs text-slate-500">
              Daftar barang yang sedang Anda ajukan atau gunakan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/kotak-masuk"
            className="text-xs font-semibold text-sky-700 hover:text-sky-800 hidden sm:flex items-center gap-1 no-underline"
          >
            Lihat semua ({myLoans.length}) <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openLoanSheet()}
            className="h-8 gap-1 text-xs border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Pinjam Baru</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        {myLoans.length === 0 ? (
          <EmptyState
            icon={Box}
            title="Tidak Ada Pinjaman Aktif"
            description="Anda belum memiliki pengajuan atau peminjaman inventaris yang sedang berjalan."
            action={
              <Button
                size="sm"
                onClick={() => openLoanSheet()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Ajukan Pinjam Sekarang
              </Button>
            }
            className="py-6"
          />
        ) : (
          <div className="space-y-3">
            {myLoans.map((loan) => (
              <div
                key={loan.id}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">
                      {loan.itemName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {loan.quantity} unit
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {loan.projectPurpose}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Kembali: {loan.expectedReturnDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={loan.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
