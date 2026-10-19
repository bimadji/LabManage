import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { userClient } from '../supabase.js';
import { validate } from '../validation.js';

interface ItemRow {
  id: string;
  name: string;
  category: string;
  location: string | null;
  kind: 'komponen' | 'barang';
  quantity: number;
  min_stock: number;
  stock_flag: 'habis' | 'menipis' | 'aman' | null;
  status: 'tersedia' | 'dipinjam';
  borrowed_by: string | null;
  borrowed_at: string | null;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  item_id: string;
  actor_id: string;
  action: string;
  before_qty: number | null;
  after_qty: number | null;
  before_status: string | null;
  after_status: string | null;
  note: string | null;
  created_at: string;
}

const ITEM_COLUMNS =
  'id, name, category, location, kind, quantity, min_stock, stock_flag, status, borrowed_by, borrowed_at, updated_at';
const HISTORY_COLUMNS =
  'id, item_id, actor_id, action, before_qty, after_qty, before_status, after_status, note, created_at';

const listSchema = z.object({
  kind: z.enum(['komponen', 'barang'], { message: 'kind harus komponen atau barang' }).optional(),
  flag: z.enum(['habis', 'menipis', 'aman'], { message: 'flag tidak dikenal' }).optional(),
  q: z.string().trim().min(1).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'name wajib diisi'),
  category: z.string().trim().min(1, 'category wajib diisi'),
  kind: z.enum(['komponen', 'barang'], { message: 'kind harus komponen atau barang' }),
  location: z.string().trim().optional(),
  quantity: z.number().int().min(0, 'quantity harus bilangan bulat >= 0').optional(),
  minStock: z.number().int().min(0, 'minStock harus bilangan bulat >= 0').optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, 'name wajib diisi').optional(),
  category: z.string().trim().min(1, 'category wajib diisi').optional(),
  location: z.string().trim().nullable().optional(),
  minStock: z.number().int().min(0, 'minStock harus bilangan bulat >= 0').optional(),
  kind: z.enum(['komponen', 'barang'], { message: 'kind harus komponen atau barang' }).optional(),
});

const quantitySchema = z.object({
  mode: z.enum(['tambah', 'kurang', 'set'], { message: 'mode harus tambah, kurang, atau set' }),
  amount: z.number().int().min(0, 'amount harus bilangan bulat >= 0'),
  note: z.string().trim().max(500).optional(),
});

function toItem(row: ItemRow, borrowerName: string | null) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    location: row.location,
    kind: row.kind,
    quantity: row.quantity,
    minStock: row.min_stock,
    stockFlag: row.stock_flag,
    status: row.status,
    borrowedBy: row.borrowed_by,
    borrowedAt: row.borrowed_at,
    borrowerName,
    updatedAt: row.updated_at,
  };
}

function toHistory(row: HistoryRow, actorName: string | null) {
  return {
    id: row.id,
    itemId: row.item_id,
    actorId: row.actor_id,
    actorName,
    action: row.action,
    beforeQty: row.before_qty,
    afterQty: row.after_qty,
    beforeStatus: row.before_status,
    afterStatus: row.after_status,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Maps the stable error codes raised by the inventory functions. */
function fromInventoryRpc(error: { code?: string; message: string }): ApiError {
  switch (error.code) {
    case 'P0001':
      return new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok tidak mencukupi', { cause: error });
    case 'P0002':
      return new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan', { cause: error });
    case 'P0003':
      return new ApiError(409, 'ITEM_UNAVAILABLE', 'Barang sedang tidak tersedia', {
        cause: error,
      });
    case 'P0004':
      return new ApiError(409, 'INVALID_STATE', 'Aksi tidak sesuai status item', { cause: error });
    case '42501':
      return new ApiError(403, 'FORBIDDEN', 'Anda tidak berhak melakukan aksi ini', {
        cause: error,
      });
    default:
      return new ApiError(500, 'INTERNAL', 'Terjadi kesalahan pada server', { cause: error });
  }
}

/** Resolves names for a set of profile ids in one query (RLS may hide some). */
async function profileNames(
  db: ReturnType<typeof userClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data, error } = await db.from('profiles').select('id, full_name').in('id', ids);
  if (error) throw fromDbError(error);
  for (const profile of data as { id: string; full_name: string }[]) {
    names.set(profile.id, profile.full_name);
  }
  return names;
}

/** Inventory items, stock changes, returns, and per-item history. Mounted after `requireAuth`. */
export function inventoryRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.get('/inventory', validate(listSchema, 'query'), async (req, res) => {
    const { kind, flag, q } = req.query as z.infer<typeof listSchema>;
    const db = dbFor(req);

    let query = db.from('inventory_items').select(ITEM_COLUMNS).order('name');
    if (kind) query = query.eq('kind', kind);
    if (flag) query = query.eq('stock_flag', flag);
    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) throw fromDbError(error);
    const rows = data as ItemRow[];

    const names = await profileNames(db, [
      ...new Set(rows.map((row) => row.borrowed_by).filter((id): id is string => id !== null)),
    ]);
    res.json(
      rows.map((row) => toItem(row, row.borrowed_by ? (names.get(row.borrowed_by) ?? null) : null)),
    );
  });

  router.post('/inventory', requireRole('admin'), validate(createSchema), async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const db = dbFor(req);
    const isBarang = body.kind === 'barang';
    const quantity = isBarang ? 1 : (body.quantity ?? 0);

    const { data, error } = await db
      .from('equipment')
      .insert({
        name: body.name,
        category: body.category,
        kind: body.kind,
        location: body.location ?? null,
        quantity,
        min_stock: isBarang ? 0 : (body.minStock ?? 0),
      })
      .select('id')
      .single<{ id: string }>();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'DUPLICATE_NAME', 'Nama item sudah dipakai', { cause: error });
      }
      throw fromDbError(error);
    }

    const { error: historyError } = await db.from('inventory_history').insert({
      item_id: data.id,
      actor_id: req.user!.id,
      action: 'buat',
      after_qty: quantity,
    });
    if (historyError) throw fromDbError(historyError);

    const { data: item, error: readError } = await db
      .from('inventory_items')
      .select(ITEM_COLUMNS)
      .eq('id', data.id)
      .single<ItemRow>();
    if (readError) throw fromDbError(readError);
    res.status(201).json(toItem(item, null));
  });

  router.patch('/inventory/:id', requireRole('admin'), validate(updateSchema), async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const db = dbFor(req);

    const { data: current, error: readError } = await db
      .from('equipment')
      .select('id, kind, quantity')
      .eq('id', req.params.id)
      .maybeSingle<{ id: string; kind: 'komponen' | 'barang'; quantity: number }>();
    if (readError) throw fromDbError(readError);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan');
    if (body.kind !== undefined && body.kind !== current.kind) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'kind tidak dapat diubah');
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.category !== undefined) patch.category = body.category;
    if (body.location !== undefined) patch.location = body.location;
    if (body.minStock !== undefined) patch.min_stock = body.minStock;

    const { error: updateError } = await db.from('equipment').update(patch).eq('id', current.id);
    if (updateError) {
      if (updateError.code === '23505') {
        throw new ApiError(409, 'DUPLICATE_NAME', 'Nama item sudah dipakai', {
          cause: updateError,
        });
      }
      throw fromDbError(updateError);
    }

    const { error: historyError } = await db.from('inventory_history').insert({
      item_id: current.id,
      actor_id: req.user!.id,
      action: 'ubah',
      before_qty: current.quantity,
      after_qty: current.quantity,
      note: 'ubah detail item',
    });
    if (historyError) throw fromDbError(historyError);

    const { data: item, error: itemError } = await db
      .from('inventory_items')
      .select(ITEM_COLUMNS)
      .eq('id', current.id)
      .single<ItemRow>();
    if (itemError) throw fromDbError(itemError);
    res.json(toItem(item, null));
  });

  router.delete('/inventory/:id', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data: item, error: readError } = await db
      .from('equipment')
      .select('id, status')
      .eq('id', req.params.id)
      .maybeSingle<{ id: string; status: 'tersedia' | 'dipinjam' }>();
    if (readError) throw fromDbError(readError);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan');
    if (item.status === 'dipinjam') {
      throw new ApiError(409, 'ITEM_ON_LOAN', 'Item sedang dipinjam dan tidak dapat dihapus');
    }

    const [components, loans] = await Promise.all([
      db
        .from('component_requests')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', item.id)
        .eq('status', 'menunggu'),
      db
        .from('loan_requests')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', item.id)
        .eq('status', 'menunggu'),
    ]);
    if (components.error) throw fromDbError(components.error);
    if (loans.error) throw fromDbError(loans.error);
    if ((components.count ?? 0) + (loans.count ?? 0) > 0) {
      throw new ApiError(409, 'PENDING_REQUESTS', 'Item masih punya permintaan menunggu');
    }

    const { error: deleteError } = await db.from('equipment').delete().eq('id', item.id);
    if (deleteError) throw fromDbError(deleteError);
    res.json({ ok: true });
  });

  router.patch(
    '/inventory/:id/quantity',
    requireRole('admin'),
    validate(quantitySchema),
    async (req, res) => {
      const { mode, amount, note } = req.body as z.infer<typeof quantitySchema>;
      const db = dbFor(req);

      const { data, error } = await db.rpc('adjust_inventory_quantity', {
        p_item_id: req.params.id,
        p_mode: mode,
        p_amount: amount,
        p_note: note ?? null,
      });
      if (error) throw fromInventoryRpc(error);

      const { data: item, error: itemError } = await db
        .from('inventory_items')
        .select(ITEM_COLUMNS)
        .eq('id', (data as { id: string }).id)
        .single<ItemRow>();
      if (itemError) throw fromDbError(itemError);
      res.json(toItem(item, null));
    },
  );

  router.patch('/inventory/:id/return', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data, error } = await db.rpc('return_inventory_item', {
      p_item_id: req.params.id,
    });
    if (error) throw fromInventoryRpc(error);

    const { data: item, error: itemError } = await db
      .from('inventory_items')
      .select(ITEM_COLUMNS)
      .eq('id', (data as { id: string }).id)
      .single<ItemRow>();
    if (itemError) throw fromDbError(itemError);
    res.json(toItem(item, null));
  });

  router.get('/inventory/:id/history', async (req, res) => {
    const db = dbFor(req);

    const { data: item, error: itemError } = await db
      .from('equipment')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle<{ id: string }>();
    if (itemError) throw fromDbError(itemError);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan');

    const { data, error } = await db
      .from('inventory_history')
      .select(HISTORY_COLUMNS)
      .eq('item_id', item.id)
      .order('created_at', { ascending: false });
    if (error) throw fromDbError(error);
    const rows = data as HistoryRow[];

    const names = await profileNames(db, [...new Set(rows.map((row) => row.actor_id))]);
    res.json(rows.map((row) => toHistory(row, names.get(row.actor_id) ?? null)));
  });

  return router;
}
