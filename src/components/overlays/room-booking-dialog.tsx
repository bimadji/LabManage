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
import { useOverlay } from "@/contexts/overlay-context";
import { useCurrentUser, useRole } from "@/contexts/role-context";
import { useData } from "@/contexts/data-context";
import { RUANGAN, SLOT_WAKTU, todayWib, toWibIso } from "@/lib/rooms";
import { Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export function RoomBookingDialog() {
  const { activeDialog, closeAllOverlays } = useOverlay();
  const currentUser = useCurrentUser();
  const { addRoomBooking } = useData();

  const isOpen = activeDialog === "booking";

  const [ruanganId, setRuanganId] = useState(RUANGAN[0].id);
  const [tanggal, setTanggal] = useState(todayWib());
  const [slotIndex, setSlotIndex] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [participantsCount, setParticipantsCount] = useState(5);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const ruangan = RUANGAN.find((r) => r.id === ruanganId) ?? RUANGAN[0];
  const slot = SLOT_WAKTU[slotIndex];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      setErrorMsg("Keperluan booking wajib diisi.");
      return;
    }

    const startTime = toWibIso(tanggal, slot.mulai);
    const endTime = toWibIso(tanggal, slot.selesai);
    if (!startTime || !endTime) {
      setErrorMsg("Tanggal atau jam sesi tidak valid. Silakan pilih ulang.");
      return;
    }

    const result = await addRoomBooking({
      roomId: ruangan.id,
      roomName: ruangan.nama,
      roomCode: ruangan.kode,
      capacity: ruangan.kapasitas,
      date: tanggal,
      timeSlot: slot.label,
      startTime,
      endTime,
      picName: currentUser.name,
      picNim: currentUser.nimOrNip,
      userId: currentUser.id,
      kelompokId: currentUser.teamId,
      kelompokNama: currentUser.team,
      purpose,
      participantsCount,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Gagal melakukan pemesanan ruangan.");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setPurpose("");
      closeAllOverlays();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAllOverlays()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-teal-600">
            <Calendar className="h-5 w-5" />
            <DialogTitle>Pemesanan Ruangan & Arena Lab</DialogTitle>
          </div>
          <DialogDescription>
            Pemesanan slot arena atau ruang diskusi untuk menghindari bentrok jadwal tim robotika.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              Pemesanan Berhasil Dicatat!
            </h4>
            <p className="text-xs text-slate-500">
              Jadwal penggunaan {ruangan.nama} telah diperbarui pada kalender lab.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Pilih Ruangan / Fasilitas Lab
              </label>
              <select
                value={ruanganId}
                onChange={(e) => setRuanganId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {RUANGAN.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama} (Kapasitas: {r.kapasitas})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Hari / Tanggal</label>
                <Input
                  type="date"
                  value={tanggal}
                  min={todayWib()}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Sesi Waktu</label>
                <select
                  value={slotIndex}
                  onChange={(e) => setSlotIndex(Number(e.target.value))}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {SLOT_WAKTU.map((slot, i) => (
                    <option key={slot.mulai} value={i}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Keperluan Penggunaan Lab
              </label>
              <Textarea
                placeholder="Contoh: Pengujian sensor lidar robot pemadam api & evaluasi algoritma"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="min-h-[60px] text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Estimasi Jumlah Orang
                </label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={participantsCount}
                  onChange={(e) => setParticipantsCount(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  PIC / Penanggung Jawab
                </label>
                <Input
                  value={currentUser.name.split(" ")[0]}
                  readOnly
                  className="bg-slate-50 text-slate-500 text-xs"
                />
              </div>
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
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                Konfirmasi Booking
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
