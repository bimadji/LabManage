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
import { useData } from "@/contexts/data-context";
import { useRole } from "@/contexts/role-context";
import type { Item } from "@/types";
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface AddStockDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStockDialog({ item, open, onOpenChange }: AddStockDialogProps) {
  const { addStockToItem } = useData();
  const { role } = useRole();

  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (role !== "admin" || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (quantity < 1) {
      setErrorMsg("Jumlah unit tambahan minimal 1.");
      return;
    }

    setIsLoading(true);
    const result = await addStockToItem(item.id, quantity);
    setIsLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || "Gagal menambah unit stok.");
      return;
    }

    setSuccessMsg(`Berhasil menambahkan ${quantity} unit ke ${item.name}!`);
    setTimeout(() => {
      setQuantity(1);
      setSuccessMsg("");
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-700">
            <Plus className="h-5 w-5" />
            <DialogTitle>Tambah Stok Unit Barang</DialogTitle>
          </div>
          <DialogDescription>
            Tambahkan kuantitas unit baru untuk inventaris terpilih.
          </DialogDescription>
        </DialogHeader>

        {successMsg ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">{successMsg}</h4>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Barang</span>
              <p className="text-xs font-bold text-slate-800">{item.name}</p>
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 font-mono">
                <span>Kode: {item.code}</span>
                <span>Stok Sekarang: {item.availableStock} / {item.totalStock} unit</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Jumlah Unit Tambahan *</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-xs font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">
                * Unit tambahan akan otomatis menambah stok total dan stok tersedia. Jika status sebelumnya habis, akan menjadi tersedia.
              </p>
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
                {isLoading ? "Menyimpan..." : "Tambah Unit"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
