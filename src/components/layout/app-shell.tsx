"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useData } from "@/contexts/data-context";
import { useRole } from "@/contexts/role-context";
import { DEMO_MODE } from "@/lib/demo";
import { ErrorState } from "@/components/common/error-state";
import { CardSkeleton } from "@/components/common/loading-skeleton";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, loadError, refreshData } = useData();
  const { currentUser, isLoading: authLoading } = useRole();

  // Halaman login tidak memakai shell aplikasi.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!DEMO_MODE && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" aria-busy="true">
        <div className="w-full max-w-2xl grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Tanpa sesi: server (proxy) sudah mengalihkan; di sisi klien tunggu pengalihan.
  if (!DEMO_MODE && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Mengalihkan ke halaman masuk...</p>
        <button
          onClick={() => router.replace("/login")}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Masuk sekarang
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f0f8ff]">
      {DEMO_MODE && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-400 py-1 text-center text-[11px] font-bold uppercase tracking-widest text-amber-950">
          Mode Demo — data contoh, perubahan tidak disimpan
        </div>
      )}

      {/* Sidebar Desktop Fixed / Sticky */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <Sidebar />
      </div>

      {/* Sidebar Mobile Drawer (Radix Sheet) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72 max-w-[80vw]">
          <Sidebar onNavClick={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Konten Utama */}
      <div className="flex flex-col flex-1 md:pl-64 min-w-0">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          {loadError ? (
            <ErrorState
              title="Gagal Memuat Data dari Database"
              message={loadError}
              onRetry={() => void refreshData()}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-busy="true">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
