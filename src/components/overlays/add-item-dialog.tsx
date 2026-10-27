"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/contexts/data-context";
import { useRole } from "@/contexts/role-context";
import type { Item, ItemCategory } from "@/types";
import { MOCK_KELOMPOK } from "@/lib/mock-data";
import { PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const { addInventoryItem } = useData();
  const { role } = useRole();

  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [kategori, setKategori] = useState<ItemCategory>("mikrokontroler");
  const [lokasi, setLokasi] = useState("");
  const [stokTotal, setStokTotal] = useState(1);
  const [spesifikasi, setSpesifikasi] = useState("");
  const [pemilikKelompokId, setPemilikKelompokId] = useState<string>("lab");
  const [dapatDipinjam, setDapatDipinjam] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (role !== "admin") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!nama.trim()) {
      setErrorMsg("Nama barang wajib diisi.");
      return;
    }
    if (!kode.trim()) {
      setErrorMsg("Kode aset barang wajib diisi.");
      return;
    }
    if (!lokasi.trim()) {
      setErrorMsg("Lokasi penyimpanan barang wajib diisi.");
      return;
    }
    if (stokTotal < 1) {
      setErrorMsg("Stok awal minimal 1 unit.");
      return;
    }

    setIsLoading(true);

    const targetKelompok = pemilikKelompokId === "lab"
      ? null
      : MOCK_KELOMPOK.find((k) => k.id === pemilikKelompokId);

    const result = await addInventoryItem({
      name: nama.trim(),
      code: kode.trim().toUpperCase(),
      category: kategori,
      categoryLabel: kategori.charAt(0).toUpperCase() + kategori.slice(1),
      totalStock: stokTotal,
      availableStock: stokTotal,
      location: lokasi.trim(),
      status: "tersedia",
      specs: spesifikasi.trim(),
      pemilikKelompokId: targetKelompok ? targetKelompok.id : null,
      pemilikKelompokNama: targetKelompok ? targetKelompok.nama : "Milik Bersama Lab",
      dapatDipinjamKelompokLain: pemilikKelompokId === "lab" ? true : dapatDipinjam,
    });

    setIsLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || "Gagal menambahkan barang.");
      return;
    }

    setSuccessMsg("Barang baru berhasil ditambahkan ke inventaris!");
    setTimeout(() => {
      setNama("");
      setKode("");
      setLokasi("");
      setStokTotal(1);
      setSpesifikasi("");
      setPemilikKelompokId("lab");
      setSuccessMsg("");
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-700">
            <PlusCircle className="h-5 w-5" />
            <DialogTitle>Tambah Barang Inventaris Baru</DialogTitle>
          </div>
          <DialogDescription>
            Masukkan rincian aset lab, kepemilikan kelompok, dan jumlah unit awal.
          </DialogDescription>
        </DialogHeader>

        {successMsg ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">{successMsg}</h4>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Barang *</label>
                <Input
                  placeholder="Contoh: NVIDIA Jetson Orin Nano"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kode Aset *</label>
                <Input
                  placeholder="LAB-MCU-01"
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Kategori *</label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as ItemCategory)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="mikrokontroler">Mikrokontroler & SBC</option>
                  <option value="sensor">Sensor</option>
                  <option value="actuator">Aktuator / Motor</option>
                  <option value="perkakas">Perkakas & Solder</option>
                  <option value="komponen">Instrumen & Komponen</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Jumlah Unit Awal *</label>
                <Input
                  type="number"
                  min={1}
                  value={stokTotal}
                  onChange={(e) => setStokTotal(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Lokasi Penyimpanan *</label>
              <Input
                placeholder="Contoh: Lemari Rak A-1 (Loker Mikrokontroler)"
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Spesifikasi / Catatan</label>
              <Textarea
                placeholder="Contoh: 8GB RAM, 40 TOPS AI compute, casing aluminium"
                value={spesifikasi}
                onChange={(e) => setSpesifikasi(e.target.value)}
                className="min-h-[50px] text-xs"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Hak Kepemilikan Barang</label>
                <select
                  value={pemilikKelompokId}
                  onChange={(e) => setPemilikKelompokId(e.target.value)}
                  className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-2xs outline-none"
                >
                  <option value="lab">Milik Bersama Lab (Dapat dipinjam semua kelompok)</option>
                  {MOCK_KELOMPOK.map((k) => (
                    <option key={k.id} value={k.id}>
                      Milik Khusus: {k.nama} ({k.jenis === "tim_riset" ? "Tim Riset" : "UKM"})
                    </option>
                  ))}
                </select>
              </div>

              {pemilikKelompokId !== "lab" && (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={dapatDipinjam}
                    onChange={(e) => setDapatDipinjam(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Dapat dipinjam oleh kelompok lain</span>
                </label>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isLoading ? "Menyimpan..." : "Simpan Barang"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
