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
import { useCurrentUser, useRole } from "@/contexts/role-context";
import { useData } from "@/contexts/data-context";
import { Item } from "@/types";
import { CheckCircle2, AlertCircle, Box } from "lucide-react";

/**
 * Isi formulir dipisah dari Sheet agar state form selalu baru saat dibuka
 * (meniakkan aturan setState-dalam-effect).
 */
function LoanRequestBody({
  selectedItemForLoan,
  onClose,
}: {
  selectedItemForLoan: Item | null;
  onClose: () => void;
}) {
  const { role } = useRole();
  const currentUser = useCurrentUser();
  const { items, addLoanRequest } = useData();

  const [selectedItemId, setSelectedItemId] = useState<string>(
    selectedItemForLoan?.id ?? items[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [projectPurpose, setProjectPurpose] = useState<string>("");
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState<string>("");
  const [successNotice, setSuccessNotice] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const currentItem = items.find((it) => it.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "admin") {
      setErrorMsg("Admin Laboratorium tidak diizinkan membuat permohonan peminjaman barang.");
      return;
    }
    if (!currentItem) {
      setErrorMsg("Silakan pilih komponen yang akan dipinjam.");
      return;
    }
    if (quantity < 1 || quantity > currentItem.availableStock) {
      setErrorMsg(`Jumlah tidak valid. Stok tersedia saat ini: ${currentItem.availableStock} unit.`);
      return;
    }
    if (!projectPurpose.trim()) {
      setErrorMsg("Keperluan riset/proyek robotika wajib diisi.");
      return;
    }

    const result = await addLoanRequest({
      itemId: currentItem.id,
      itemName: currentItem.name,
      itemCode: currentItem.code,
      itemCategory: currentItem.category,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterNim: currentUser.nimOrNip,
      requesterAvatar: currentUser.avatar,
      requesterKelompokId: currentUser.teamId,
      requesterKelompokNama: currentUser.team,
      quantity,
      projectPurpose,
      expectedReturnDate,
      notes,
    });

    if (!result.success) {
      setErrorMsg(result.error ?? "Permohonan gagal disimpan.");
      return;
    }

    setSuccessNotice(true);
    setTimeout(() => {
      setSuccessNotice(false);
      onClose();
    }, 1500);
  };

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 text-emerald-600">
          <Box className=" w-5" />
          <SheetTitle>Formulir Peminjaman Alat</SheetTitle>
        </div>
        <SheetDescription>
          Peminjaman komponen robotika dan peralatan lab untuk keperluan riset atau kontes.
        </SheetDescription>
      </SheetHeader>

      {successNotice ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className=" w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
            <CheckCircle2 className=" w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            Permohonan Berhasil Dikirim!
          </h3>
          <p className="text-xs text-slate-500 max-w-xs">
            Permohonan peminjaman {quantity}x {currentItem?.name} telah masuk ke kotak verifikasi Kepala Lab.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          <div className="space-y-4 pt-2">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className=" w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Data Peminjam (Auto) */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Identitas Pemohon
              </span>
              <p className="text-xs font-bold text-slate-800">
                {currentUser.name} ({currentUser.nimOrNip})
              </p>
              <p className="text-[11px] text-slate-500">{currentUser.team}</p>
            </div>

            {/* Pilih Barang */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Pilih Komponen / Alat Lab <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full  rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id} disabled={it.availableStock <= 0}>
                    {it.name} ({it.code}) - Sisa {it.availableStock} unit {it.availableStock <= 0 ? "[Stok Habis]" : ""}
                  </option>
                ))}
              </select>
              {currentItem && (
                <p className="text-[11px] text-slate-500">
                  Lokasi simpan: <strong>{currentItem.location}</strong>
                </p>
              )}
            </div>

            {/* Jumlah */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Jumlah yang Dipinjam <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={currentItem?.availableStock || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-xs text-slate-500">
                  Maksimal {currentItem?.availableStock || 0} unit
                </span>
              </div>
            </div>

            {/* Keperluan Riset */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Keperluan Proyek / Riset Robotika <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Pengujian algoritma odometri & uji coba arena untuk KRAI 2025"
                value={projectPurpose}
                onChange={(e) => setProjectPurpose(e.target.value)}
                className="min-h-[70px] text-xs"
                required
              />
            </div>

            {/* Estimasi Tanggal Kembali */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Estimasi Tanggal Pengembalian <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            {/* Catatan Tambahan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Catatan Tambahan (Opsional)
              </label>
              <Input
                placeholder="Contoh: Butuh kabel konektor micro-USB tambahan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Ajukan Pinjaman
            </Button>
          </SheetFooter>
        </form>
      )}
    </>
  );
}

export function LoanRequestSheet() {
  const { activeSheet, closeAllOverlays, selectedItemForLoan } = useOverlay();
  const isOpen = activeSheet === "loan";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeAllOverlays()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md md:max-w-lg">
        {isOpen && (
          <LoanRequestBody
            selectedItemForLoan={selectedItemForLoan}
            onClose={closeAllOverlays}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
