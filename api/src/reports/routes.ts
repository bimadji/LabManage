import { Router, type Request } from 'express';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { createNotification } from '../notifications/create.js';
import { userClient } from '../supabase.js';
import { validate } from '../validation.js';
import { z } from 'zod';
import { canTransition, REPORT_STATUSES, type ReportStatus } from './transitions.js';

interface ReportRow {
  id: string;
  category: string;
  description: string;
  location: string;
  reported_by: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, category, description, location, reported_by, status, created_at, updated_at';
const MIN_DESCRIPTION = 5;
const MAX_DESCRIPTION = 1000;

const createReportSchema = z.object({
  category: z.enum(['lampu', 'ventilasi', 'kerusakan'], {
    message: 'category harus lampu, ventilasi, atau kerusakan',
  }),
  description: z
    .string()
    .trim()
    .min(MIN_DESCRIPTION, `description harus ${MIN_DESCRIPTION}-${MAX_DESCRIPTION} karakter`)
    .max(MAX_DESCRIPTION, `description harus ${MIN_DESCRIPTION}-${MAX_DESCRIPTION} karakter`),
  location: z.string().trim().min(1, 'location wajib diisi'),
});

const updateStatusSchema = z.object({
  status: z.enum(REPORT_STATUSES, { message: 'status tidak dikenal' }),
});

function toReport(row: ReportRow) {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    location: row.location,
    reportedBy: row.reported_by,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Facility reports and their status flow. Must be mounted after `requireAuth`. */
export function reportsRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.post(
    '/facility-reports',
    requireRole('anggota', 'admin'),
    validate(createReportSchema),
    async (req, res) => {
      const { category, description, location } = req.body as z.infer<typeof createReportSchema>;

      const { data, error } = await dbFor(req)
        .from('facility_reports')
        .insert({ category, description, location, reported_by: req.user!.id })
        .select(COLUMNS)
        .single<ReportRow>();
      if (error) throw fromDbError(error);
      res.status(201).json(toReport(data));
    },
  );

  router.get('/facility-reports', async (req, res) => {
    // RLS already limits members to their own rows and lets admin/advisor see all.
    const { data, error } = await dbFor(req)
      .from('facility_reports')
      .select(COLUMNS)
      .order('created_at', { ascending: false });
    if (error) throw fromDbError(error);
    res.json((data as ReportRow[]).map(toReport));
  });

  router.patch(
    '/facility-reports/:id/status',
    requireRole('admin'),
    validate(updateStatusSchema),
    async (req, res) => {
      const next = (req.body as z.infer<typeof updateStatusSchema>).status;

      const db = dbFor(req);
      const { data: existing, error } = await db
        .from('facility_reports')
        .select('status')
        .eq('id', req.params.id)
        .maybeSingle<{ status: ReportStatus }>();
      if (error) throw fromDbError(error);
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Laporan tidak ditemukan');

      if (!canTransition(existing.status, next)) {
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          `Status tidak dapat berubah dari ${existing.status} ke ${next}`,
        );
      }

      const { data, error: updateError } = await db
        .from('facility_reports')
        .update({ status: next })
        .eq('id', req.params.id)
        .select(COLUMNS)
        .single<ReportRow>();
      if (updateError) {
        // The SQL trigger repeats the same rule, so a race cannot slip through.
        if (updateError.code === 'P0001') {
          throw new ApiError(422, 'INVALID_TRANSITION', 'Status tidak dapat berubah', {
            cause: updateError,
          });
        }
        throw fromDbError(updateError);
      }

      await createNotification(config, {
        userId: data.reported_by,
        kind: 'laporan',
        message: `Status laporan Anda berubah menjadi ${data.status}.`,
      });

      res.json(toReport(data));
    },
  );

  return router;
}
