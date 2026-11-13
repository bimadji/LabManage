import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Insight instant-navigation berlaku dev-only dan tidak memblokir build.
  // Halaman-halaman LabManage penuh 'use client' dengan data Supabase sisi
  // klien (bukan shell statis), jadi insight itu hanya kebisingan — batasi
  // validasi ke route yang secara eksplisit meng-export `instant`.
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  // dev dari HP/PC lain di LAN: izinkan origin laptop untuk resource dev (HMR)
  allowedDevOrigins: ["192.168.1.14"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
