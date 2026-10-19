import { Router, type Request } from 'express';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';

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

  router.post('/equipment', requireRole('admin'), async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const totalQty = Number(body.totalQty);
    if (name === '' || category === '') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'name dan category wajib diisi');
    }
    if (!Number.isInteger(totalQty) || totalQty < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'totalQty harus bilangan bulat >= 0');
    }

    const { data, error } = await dbFor(req)
      .from('equipment')
      .insert({
        name,
        category,
        total_qty: totalQty,
        location: typeof body.location === 'string' ? body.location : null,
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
  });

  router.post('/equipment/:id/loans', requireRole('anggota', 'admin'), async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const qty = Number(body.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'qty harus bilangan bulat lebih dari 0');
    }

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
  });

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
