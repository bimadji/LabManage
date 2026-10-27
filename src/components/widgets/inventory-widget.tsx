"use client";

import React from "react";
import Link from "next/link";
import { Cpu, ArrowRight } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";

export function InventoryWidget() {
  const { items } = useData();
  const { openLoanSheet } = useOverlay();

  // Ambil 4 item penting untuk cuplikan beranda
  const highlightItems = items.slice(0, 4);

  return (
    <Card className="border-slate-200/80 shadow-xs bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <Cpu className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Katalog Cepat Inventaris
            </CardTitle>
            <p className="text-xs text-slate-500">
              Komponen & mikrokontroler robotika siap pakai
            </p>
          </div>
        </div>

        <Link
          href="/inventaris"
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 no-underline"
        >
          Lihat Semua ({items.length}) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="pt-1 space-y-2.5">
        {highlightItems.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-slate-800 truncate">
                  {item.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {item.code}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Lokasi: {item.location}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[11px] font-medium text-slate-600">
                  Sisa: <strong className="text-slate-800 font-bold">{item.availableStock}</strong> / {item.totalStock} unit
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={item.status} />
              <Button
                size="sm"
                variant="outline"
                disabled={item.availableStock <= 0}
                onClick={() => openLoanSheet(item)}
                className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                Pinjam
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
