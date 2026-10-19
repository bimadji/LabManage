export const REPORT_STATUSES = ['baru', 'ditindaklanjuti', 'selesai'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Only forward moves are allowed: baru → ditindaklanjuti → selesai. */
const NEXT: Record<ReportStatus, ReportStatus | null> = {
  baru: 'ditindaklanjuti',
  ditindaklanjuti: 'selesai',
  selesai: null,
};

/** True when `to` is the single permitted next status after `from`. */
export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return NEXT[from] === to;
}
