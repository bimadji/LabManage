"use client";

import React, { useState } from "react";
import {
  Cpu,
  Search,
  Filter,
  Plus,
  MapPin,
  Layers,
  Box,
  Building2,
  Users,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useOverlay } from "@/contexts/overlay-context";
import { useRole } from "@/contexts/role-context";
import { BRANDING } from "@/lib/branding";
import { Banner } from "@/components/common/banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";

export default function InventarisPage() {
  const { items } = useData();
  const { openLoanSheet } = useOverlay();
  const { currentUser, role } = useRole();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("semua");
  const [ownershipFilter, setOwnershipFilter] = useState<"semua" | "lab" | "kelompok" | "bisa_pinjam">("semua");

  const categories = [
    { id: "semua", label: "Semua Kategori" },
    { id: "mikrokontroler", label: "Mikrokontroler & SBC" },
    { id: "sensor", label: "Sensor" },
    { id: "actuator", label: "Aktuator / Motor" },
    { id: "perkakas", label: "Perkakas & Solder" },
    { id: "komponen", label: "Instrumen & Pasif" },
  ];

  // RLS-aware item filtering in UI
  const filteredItems = items.filter((item) => {
    // RLS emulation:
    // Admin & Advisor see all
    // Anggota can see: lab owned, own group owned, or can be borrowed by other groups
    if (role === "anggota") {
      const isLabOwned = !item.pemilikKelompokId;
      const isOwnGroup = item.pemilikKelompokId === currentUser.teamId;
      const isShareable = item.dapatDipinjamKelompokLain === true;
      if (!isLabOwned && !isOwnGroup && !isShareable) {
        return false;
      }
    }

    // Ownership tab filter
    if (ownershipFilter === "lab" && item.pemilikKelompokId !== null) return false;
    if (ownershipFilter === "kelompok" && item.pemilikKelompokId !== currentUser.teamId) return false;
    if (ownershipFilter === "bisa_pinjam" && !item.dapatDipinjamKelompokLain && item.pemilikKelompokId !== null) return false;

    // Search query
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.pemilikKelompokNama || "").toLowerCase().includes(searchQuery.toLowerCase());

    // Category
    const matchesCategory =
      selectedCategory === "semua" || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <Banner
        title={BRANDING.titles.inventory}
        description={`Jelajahi ketersediaan aset lab, mikrokontroler STM32, sensor LiDAR, aktuator Roboholic & Tim Riset, serta instrumen uji bersama.`}
        badgeText={`Inventaris Terpadu Lab Robotika`}
        action={
          <Button
            onClick={() => openLoanSheet()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Ajukan Pinjam Barang</span>
          </Button>
        }
        icon={<Cpu className="h-28 w-28" />}
      />

      {/* Filter Kepemilikan Tab */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
          Kepemilikan:
        </span>
        <button
          onClick={() => setOwnershipFilter("semua")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            ownershipFilter === "semua"
              ? "bg-slate-800 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Semua Aset Terlihat
        </button>
        <button
          onClick={() => setOwnershipFilter("lab")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            ownershipFilter === "lab"
              ? "bg-emerald-700 text-white shadow-2xs"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          <Building2 className="h-3 w-3" />
          Milik Bersama Lab
        </button>
        <button
          onClick={() => setOwnershipFilter("kelompok")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            ownershipFilter === "kelompok"
              ? "bg-indigo-700 text-white shadow-2xs"
              : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
          }`}
        >
          <Users className="h-3 w-3" />
          Milik Kelompok Saya ({currentUser.team})
        </button>
        <button
          onClick={() => setOwnershipFilter("bisa_pinjam")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            ownershipFilter === "bisa_pinjam"
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-teal-50 text-teal-800 hover:bg-teal-100"
          }`}
        >
          Bisa Dipinjam Lintas Kelompok
        </button>
      </div>

      {/* Toolbar Pencarian & Filter Kategori */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari nama alat, kode aset, lokasi, atau kelompok pemilik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter className="h-4 w-4 text-slate-400 mr-1 hidden sm:block" />
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Kartu Inventaris */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Box}
          title="Komponen Tidak Ditemukan"
          description={`Tidak ada hasil untuk pencarian "${searchQuery}" pada filter kepemilikan / kategori yang dipilih.`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("semua");
                setOwnershipFilter("semua");
              }}
            >
              Reset Filter Pencarian
            </Button>
          }
          className="bg-white py-12"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">
          {filteredItems.map((item) => {
            const isAvailable = item.availableStock > 0 && item.status !== "rusak" && item.status !== "habis";

            return (
              <Card
                key={item.id}
                className="flex flex-col overflow-hidden border-slate-200 bg-white hover:border-emerald-300 transition-all duration-200 group"
              >
                <div className="h-28 bg-gradient-to-tr from-slate-100 via-sky-50 to-emerald-50 p-4 flex flex-col justify-between border-b border-slate-100 relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold bg-white/90 text-slate-700 px-2 py-0.5 rounded shadow-2xs border border-slate-200/60">
                      {item.code}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
                      <Layers className="h-3 w-3" />
                      <span>{item.categoryLabel}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        !item.pemilikKelompokId
                          ? "bg-slate-200 text-slate-700"
                          : item.pemilikKelompokId === currentUser.teamId
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                          : "bg-purple-100 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {item.pemilikKelompokNama}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.specs}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Stok Tersedia
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          <strong className="text-emerald-600 text-sm font-extrabold font-mono">
                            {item.availableStock}
                          </strong>{" "}
                          / {item.totalStock} unit
                        </span>
                      </div>

                      <Button
                        size="sm"
                        disabled={!isAvailable}
                        onClick={() => openLoanSheet(item)}
                        className={`h-8 text-xs font-semibold ${
                          isAvailable
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        {isAvailable ? "Ajukan Pinjam" : "Tidak Tersedia"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
