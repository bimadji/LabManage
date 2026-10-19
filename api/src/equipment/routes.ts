import { Router, type Request } from 'express';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';
import { validate } from '../validation.js';
import { z } from 'zod';

interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  total_qty: number;
  location: string | null;
  available: number;
}

interface LoanRow {
  id: string;
  equipment_id: string;
  user_id: string;
  qty: number;
  borrowed_at: string;
  returned_at: string | null;
}

const LOAN_COLUMNS = 'id, equipment_id, user_id, qty, borrowed_at, returned_at';

const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'name wajib diisi'),
  category: z.string().trim().min(1, 'category wajib diisi'),
  totalQty: z.number().int().min(0, 'totalQty harus bilangan bulat >= 0'),
  location: z.string().optional(),
});

const borrowSchema = z.object({
  qty: z.number().int().positive('qty harus bilangan bulat lebih dari 0'),
});

function toLoan(row: LoanRow) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    userId: row.user_id,
    qty: row.qty,
    borrowedAt: row.borrowed_at,
    returnedAt: row.returned_at,
  };
}

/** Inventory catalog, borrowing, and returns. Must be mounted after `requireAuth`. */
export function equipmentRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.get('/equipment', async (req, res) => {
    const { data, error } = await dbFor(req)
      .from('equipment_availability')
      .select('id, name, category, total_qty, location, available')
      .order('name');
    if (error) throw fromDbError(error);
    res.json(
      (data as EquipmentRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        totalQty: row.total_qty,
        location: row.location,
        available: row.available,
      })),
    );
  });

  router.post(
    '/equipment',
    requireRole('admin'),
    validate(createEquipmentSchema),
    async (req, res) => {
      const body = req.body as z.infer<typeof createEquipmentSchema>;

      const { data, error } = await dbFor(req)
        .from('equipment')
        .insert({
          name: body.name,
          category: body.category,
          total_qty: body.totalQty,
          location: body.location ?? null,
        })
        .select('id, name, category, total_qty, location')
        .single<Omit<EquipmentRow, 'available'>>();
      if (error) throw fromDbError(error);
      res.status(201).json({
        id: data.id,
        name: data.name,
        category: data.category,
        totalQty: data.total_qty,
        location: data.location,
      });
    },
  );

  router.post(
    '/equipment/:id/loans',
    requireRole('anggota', 'admin'),
    validate(borrowSchema),
    async (req, res) => {
      const { qty } = req.body as z.infer<typeof borrowSchema>;

      // The function locks the equipment row, so stock cannot be oversold.
      const { data, error } = await dbFor(req).rpc('borrow_equipment', {
        p_equipment_id: req.params.id,
        p_qty: qty,
      });
      if (error) {
        if (error.code === 'P0001') {
          throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok alat tidak mencukupi', {
            cause: error,
          });
        }
        if (error.code === 'P0002') {
          throw new ApiError(404, 'NOT_FOUND', 'Alat tidak ditemukan', { cause: error });
        }
        if (error.code === '22023') {
          throw new ApiError(400, 'VALIDATION_ERROR', 'qty harus bilangan bulat lebih dari 0', {
            cause: error,
          });
        }
        throw fromDbError(error);
      }
      res.status(201).json(toLoan(data as LoanRow));
    },
  );

  router.patch('/equipment/loans/:loanId/return', async (req, res) => {
    const db = dbFor(req);
    const { data: existing, error } = await db
      .from('equipment_loans')
      .select(LOAN_COLUMNS)
      .eq('id', req.params.loanId)
      .maybeSingle<LoanRow>();
    if (error) throw fromDbError(error);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Pinjaman tidak ditemukan');
    if (existing.returned_at) {
      throw new ApiError(409, 'ALREADY_RETURNED', 'Pinjaman ini sudah dikembalikan');
    }

    const { data, error: updateError } = await db
      .from('equipment_loans')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', req.params.loanId)
      .select(LOAN_COLUMNS)
      .maybeSingle<LoanRow>();
    if (updateError) throw fromDbError(updateError);
    if (!data) throw new ApiError(403, 'FORBIDDEN', 'Anda tidak berhak mengembalikan pinjaman ini');
    res.json(toLoan(data));
  });

  return router;
}
