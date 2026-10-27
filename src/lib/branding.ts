/**
 * Konfigurasi dan teks branding terpusat LabManage.
 * Menjamin konsistensi penyebutan "Lab Robotika & UKM PENS"
 * serta istilah kelompok pengguna "Tim & UKM".
 */

export const BRANDING = {
  appName: "LabManage",
  campusShort: "PENS",
  campusFull: "Politeknik Elektronika Negeri Surabaya",
  
  // Teks cakupan lab & ukm
  scopeName: "Lab Robotika & UKM PENS",
  scopeSubtitle: "Lab Robotika & UKM PENS",
  breadcrumbRoot: "Lab Robotika & UKM PENS",
  footerTagline: "Lab Robotika & UKM PENS",
  
  // Kelompok Pengguna
  userGroupLabel: "Tim & UKM",
  userGroupSingular: "Tim/UKM",
  
  // Halaman & Navigasi
  nav: {
    home: "Beranda",
    inventory: "Inventaris",
    schedule: "Jadwal Ruangan",
    inboxAdmin: "Kotak Masuk",
    inboxMember: "Permintaan Saya",
    monitoring: "Monitoring Tim & UKM",
  },

  // Titles
  titles: {
    home: "Beranda Utama",
    inventory: "Katalog Inventaris & Alat",
    schedule: "Jadwal Ruangan & Fasilitas",
    inbox: "Kotak Masuk Verifikasi",
    myRequests: "Permintaan & Laporan Saya",
    monitoring: "Monitoring Kehadiran Tim & UKM",
  },
} as const;
