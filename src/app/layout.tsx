import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/contexts/role-context";
import { AttendanceProvider } from "@/contexts/attendance-context";
import { OverlayProvider } from "@/contexts/overlay-context";
import { DataProvider } from "@/contexts/data-context";
import { OverlayContainer } from "@/components/overlays/overlay-container";
import { AppShell } from "@/components/layout/app-shell";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LabManage - Sistem Manajemen Laboratorium Robotika PENS",
    template: "%s | LabManage PENS",
  },
  description:
    "Platform terpadu pengelolaan inventaris, presensi riset, peminjaman alat, dan reservasi fasilitas Laboratorium Robotika PENS.",
  applicationName: "LabManage",
  authors: [{ name: "Lab Robotika PENS" }],
  generator: "LabManage",
  keywords: [
    "LabManage",
    "Laboratorium Robotika",
    "PENS",
    "Inventaris Robotika",
    "Presensi Lab",
    "Tim Riset EROS",
    "Tim Riset EIRA",
    "Roboholic",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "LabManage PENS",
    title: "LabManage - Sistem Manajemen Laboratorium Robotika PENS",
    description:
      "Platform terpadu pengelolaan inventaris, presensi riset, peminjaman alat, dan reservasi fasilitas Laboratorium Robotika PENS.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={dmSans.variable}>
      <body className="antialiased bg-[#f0f8ff] text-slate-700 min-h-screen">
        <RoleProvider>
          <DataProvider>
            <AttendanceProvider>
              <OverlayProvider>
                <AppShell>{children}</AppShell>
                <OverlayContainer />
              </OverlayProvider>
            </AttendanceProvider>
          </DataProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
