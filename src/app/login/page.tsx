"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, LogIn, AlertCircle } from "lucide-react";
import { useRole } from "@/contexts/role-context";
import { BRANDING } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Server mengalihkan ke /login dengan alasan=belum-terdaftar bila akun login
  // tapi belum punya baris profiles.
  const belumTerdaftar = params.get("alasan") === "belum-terdaftar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setBusy(true);

    const result = await signIn(email.trim(), password);
    setBusy(false);

    if (!result.success) {
      setErrorMsg(result.error ?? "Gagal masuk. Periksa email dan kata sandi.");
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {BRANDING.appName}
          </h1>
          <p className="text-xs text-slate-500">
            Sistem Manajemen Laboratorium Robotika PENS. Masuk dengan akun yang diberikan
            kepala laboratorium.
          </p>
        </div>

        {belumTerdaftar && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Akunmu belum didaftarkan oleh admin lab. Hubungi Kepala Laboratorium Robotika PENS
              agar akunmu ditambahkan ke daftar pengguna.
            </span>
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3.5"
        >
          {errorMsg && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="nama@labmanage.test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-sm"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700" htmlFor="password">
              Kata Sandi
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Kata sandi akun"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-sm"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
          >
            <LogIn className="h-4 w-4" />
            <span>{busy ? "Memproses..." : "Masuk"}</span>
          </Button>
        </form>

        <p className="text-center text-[11px] text-slate-400">
          Butuh akun? Hubungi Kepala Laboratorium Robotika PENS.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
