# DESIGN.md - Sistem Desain LabManage (Ocean Breeze)

Dokumen ini mengunci seluruh aturan desain, token warna, tipografi, dan gaya komponen untuk **LabManage** (Sistem Manajemen Lab Robotika PENS).

---

## 1. Tipografi
- **Font Utama**: `DM Sans` (diimpor via `next/font/google`).
- **Font Variable**: `--font-dm-sans`.
- **Bobot Font**:
  - Regular: 400
  - Medium: 500
  - Semi-Bold: 600
  - Bold: 700
- **Ukuran Hierarki**:
  - H1 / Banner Title: 1.875rem (30px), font-bold, tracking-tight.
  - H2 / Section Title: 1.25rem (20px), font-semibold, tracking-tight.
  - H3 / Card Title: 1rem (16px), font-semibold.
  - Body: 0.875rem (14px), leading-relaxed, text-slate-700.
  - Caption / Subtitle: 0.75rem (12px), text-slate-500.

---

## 2. Palet Tema Ocean Breeze (Light Mode Default)

Palet warna terinspirasi dari udara segar laut dan presisi laboratorium teknologi modern:

```css
:root {
  --background: #f0f8ff;         /* Alice Blue lembut sebagai latar dasar */
  --foreground: #374151;         /* Slate-700 untuk teks kontras ramah */
  --card: #ffffff;               /* Putih bersih untuk seluruh kontainer kartu */
  --card-foreground: #374151;
  --popover: #ffffff;
  --popover-foreground: #374151;
  --primary: #22c55e;            /* Emerald Green cerah (keberhasilan/aksi utama) */
  --primary-foreground: #ffffff;
  --secondary: #e0f2fe;          /* Sky-100 aksen lembut */
  --secondary-foreground: #0369a1;/* Sky-700 */
  --accent: #d1fae5;             /* Mint-100 aksen halus */
  --accent-foreground: #065f46;  /* Mint-800 */
  --muted: #f1f5f9;              /* Slate-100 */
  --muted-foreground: #64748b;   /* Slate-500 */
  --destructive: #ef4444;        /* Rose/Red-500 */
  --destructive-foreground: #ffffff;
  --border: #e2e8f0;             /* Slate-200 */
  --input: #e2e8f0;
  --ring: #22c55e;
  --radius: 0.5rem;              /* 8px (rounded-lg) */
}
```

---

## 3. Token Status Badge (Wajib Konsisten)

Setiap entitas dengan status (Peminjaman, Inventaris, Tiket) HARUS menggunakan warna token berikut:

| Status      | Background | Border   | Teks     | Tailwind Class Semantik |
|-------------|------------|----------|----------|--------------------------|
| `menunggu`  | `#fef3c7`  | `#fde68a`| `#b45309`| `bg-amber-100 border-amber-200 text-amber-800` |
| `disetujui` | `#dcfce7`  | `#bbf7d0`| `#15803d`| `bg-emerald-100 border-emerald-200 text-emerald-800` |
| `ditolak`   | `#fee2e2`  | `#fecaca`| `#b91c1c`| `bg-rose-100 border-rose-200 text-rose-800` |
| `rusak`     | `#ffedd5`  | `#fed7aa`| `#c2410c`| `bg-orange-100 border-orange-200 text-orange-800` |
| `tersedia`  | `#e0f2fe`  | `#bae6fd`| `#0369a1`| `bg-sky-100 border-sky-200 text-sky-800` |
| `dipinjam`  | `#ede9fe`  | `#ddd6fe`| `#6d28d9`| `bg-purple-100 border-purple-200 text-purple-800` |

---

## 4. Aturan Komponen & UI

1. **Radius**:
   - Seluruh kontainer kartu, tombol, badge, input, dan panel samping menggunakan radius dasar `0.5rem` (`rounded-lg`).
   - Avatar & pill status menggunakan `rounded-full`.

2. **Aturan Kartu**:
   - Background: `#ffffff`.
   - Border: `border border-slate-200`.
   - Shadow: `shadow-sm hover:shadow-md transition-shadow duration-200`.
   - Padding standar: `p-5` atau `p-6` (ringkas: `p-4`).

3. **Aturan Navigasi & Link**:
   - **DILARANG** menggunakan link teks bergaris bawah default browser (`underline`).
   - Seluruh tautan menggunakan tombol bergaya atau `StyledLink` dengan transisi warna halus (`text-slate-600 hover:text-emerald-600 font-medium transition-colors`).

4. **Banner Ocean Breeze**:
   - Gradasi lembut: `bg-gradient-to-r from-emerald-50 via-sky-50 to-teal-50 border border-emerald-100/70`.

5. **Slide-over Sheet & Dialog**:
   - Panel samping (Sheet) bergeser dari kanan (`w-full sm:max-w-md md:max-w-lg`).
   - Dialog terpusat di tengah layar dengan backdrop blur `backdrop-blur-sm bg-slate-900/40`.
   - Tanpa perpindahan URL/reload layar untuk menjaga alur kerja pengguna tetap fokus.

6. **Bahasa Antarmuka**:
   - 100% menggunakan Bahasa Indonesia baku yang lugas dan ramah pengguna lab teknik/robotika.
