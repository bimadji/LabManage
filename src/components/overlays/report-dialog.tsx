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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOverlay } from "@/contexts/overlay-context";
import { useRole } from "@/contexts/role-context";
import { useData } from "@/contexts/data-context";
import { AlertTriangle, CheckCircle2, Box } from "lucide-react";

export function ReportDialog() {
  const { activeDialog, closeAllOverlays } = useOverlay();
  const { currentUser, role } = useRole();
  const { addLabReport } = useData();

  const isOpen = activeDialog === "report";

  const [tabType, setTabType] = useState<"habis" | "rusak">("rusak");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Meja Fabrikasi & Solder D-1");
  const [urgency, setUrgency] = useState<"normal" | "tinggi" | "darurat">("normal");
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    addLabReport({
      type: tabType,
      title,
      description,
      location,
      reporterName: currentUser.name,
      reporterRole: role,
      urgency,
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setTitle("");
      setDescription("");
      closeAllOverlays();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAllOverlays()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Lapor Masalah / Stok Habis</DialogTitle>
          </div>
          <DialogDescription>
            Bantu pengelola lab mendata komponen yang rusak atau persediaan perkakas yang menipis.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              Laporan Berhasil Terkirim!
            </h4>
            <p className="text-xs text-slate-500">
              Pengelola laboratorium akan segera menindaklanjuti laporan Anda.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs
              value={tabType}
              onValueChange={(v) => setTabType(v as "habis" | "rusak")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="rusak" className="text-xs">
                  Inventaris / Komponen Rusak
                </TabsTrigger>
                <TabsTrigger value="habis" className="text-xs">
                  Bahan / Stok Habis
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Nama Barang / Judul Masalah <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder={
                  tabType === "rusak"
                    ? "Contoh: Motor servo Dynamixel gear pecah"
                    : "Contoh: Timah solder 60/40 atau kabel jumper habis"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Lokasi Meja / Lemari Lab <span className="text-rose-500">*</span>
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Tingkat Urgensi
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["normal", "tinggi", "darurat"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setUrgency(lvl)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      urgency === lvl
                        ? lvl === "darurat"
                          ? "bg-rose-100 border-rose-300 text-rose-800"
                          : lvl === "tinggi"
                          ? "bg-orange-100 border-orange-300 text-orange-800"
                          : "bg-sky-100 border-sky-300 text-sky-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Deskripsi Kendala / Kebutuhan <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Jelaskan detail kronologi kerusakan atau perkiraan jumlah kebutuhan..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[70px] text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeAllOverlays}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Kirim Laporan
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
