"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOverlay } from "@/contexts/overlay-context";
import { useData } from "@/contexts/data-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { ShieldCheck, Check, X, AlertCircle } from "lucide-react";

export function ReviewRequestSheet() {
  const {
    activeSheet,
    closeAllOverlays,
    selectedRequestForReview,
    selectedReportForReview,
  } = useOverlay();
  const { updateLoanRequestStatus, updateReportStatus } = useData();

  const isOpen = activeSheet === "review";
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const handleApprove = () => {
    if (selectedRequestForReview) {
      updateLoanRequestStatus(selectedRequestForReview.id, "disetujui");
    } else if (selectedReportForReview) {
      updateReportStatus(selectedReportForReview.id, "ditangani");
    }
    closeAllOverlays();
  };

  const handleReject = () => {
    if (selectedRequestForReview) {
      updateLoanRequestStatus(
        selectedRequestForReview.id,
        "ditolak",
        reason.trim() || "Tidak memenuhi ketentuan peminjaman lab."
      );
    } else if (selectedReportForReview) {
      updateReportStatus(selectedReportForReview.id, "selesai");
    }
    setRejectMode(false);
    setReason("");
    closeAllOverlays();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeAllOverlays()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md md:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
            <SheetTitle>
              {selectedRequestForReview
                ? "Verifikasi Peminjaman Barang"
                : "Tinjau Laporan Lab"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {selectedRequestForReview
              ? "Tinjau kelayakan peminjaman alat sebelum disetujui atau ditolak."
              : "Detail laporan kendala teknis atau kebutuhan stok laboratorium."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {selectedRequestForReview && (
            <>
              {/* Info Pemohon */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={selectedRequestForReview.requesterAvatar}
                    alt={selectedRequestForReview.requesterName}
                  />
                  <AvatarFallback>
                    {selectedRequestForReview.requesterName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {selectedRequestForReview.requesterName}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500">
                    NIM: {selectedRequestForReview.requesterNim}
                  </p>
                </div>
                <div className="ml-auto">
                  <StatusBadge status={selectedRequestForReview.status} />
                </div>
              </div>

              {/* Rincian Barang yang Diminta */}
              <div className="space-y-2 p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Komponen yang Diminta
                </span>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-800">
                    {selectedRequestForReview.itemName}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {selectedRequestForReview.quantity} Unit
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  Kode: {selectedRequestForReview.itemCode} • Kategori: {selectedRequestForReview.itemCategory}
                </p>
              </div>

              {/* Keperluan */}
              <div className="space-y-1.5 p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tujuan Proyek / Riset
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedRequestForReview.projectPurpose}
                </p>
                <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 flex justify-between">
                  <span>Diajukan: {selectedRequestForReview.requestDate}</span>
                  <span>Target Kembali: {selectedRequestForReview.expectedReturnDate}</span>
                </div>
              </div>

              {/* Mode Tolak */}
              {rejectMode && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
                  <span className="text-xs font-bold text-rose-800 block">
                    Alasan Penolakan Permintaan:
                  </span>
                  <Textarea
                    placeholder="Contoh: Alat sedang dalam perawatan atau instruksi pembina..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs min-h-[60px] bg-white"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectMode(false)}
                      className="text-xs h-7"
                    >
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleReject}
                      className="text-xs h-7"
                    >
                      Konfirmasi Tolak
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {selectedReportForReview && (
            <div className="space-y-3 p-3.5 rounded-lg border border-slate-200 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {selectedReportForReview.title}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Lokasi: {selectedReportForReview.location}
                  </p>
                </div>
                <StatusBadge
                  status={selectedReportForReview.type === "rusak" ? "rusak" : "menunggu"}
                  label={selectedReportForReview.type === "rusak" ? "Rusak" : "Habis"}
                  showIcon={false}
                />
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedReportForReview.description}
              </p>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                Pelapor: {selectedReportForReview.reporterName} • {selectedReportForReview.createdAt}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="mt-4">
          {!rejectMode && (
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectMode(true)}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Tolak
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Setujui Peminjaman
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
