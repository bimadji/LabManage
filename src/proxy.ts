import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_PATHS = ["/login"];
const ADMIN_ONLY = ["/monitoring"];

/**
 * Guard sisi server (Next 16: `proxy`, bukan `middleware`).
 * - belum login -> /login
 * - login tapi belum punya baris profiles -> /login (belum didaftarkan admin lab)
 * - role tidak berhak pada rute khusus -> / (bukan 403 kosong)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Profil wajib ada: tanpa baris profiles role tidak diketahui dan RLS menolak semua akses.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    loginUrl.searchParams.set("alasan", "belum-terdaftar");
    return NextResponse.redirect(loginUrl);
  }

  const role = (profile as { role?: string }).role;

  if (ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    if (role !== "admin" && role !== "advisor") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|.*\\.svg$).*)"],
};
