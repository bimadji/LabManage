import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/requireAuth.js';
import type { Config } from '../config.js';
import { ApiError, fromDbError } from '../errors.js';
import { createNotification, notifyAdmins } from '../notifications/create.js';
import { serviceClient, userClient } from '../supabase.js';
import { uuid, validate } from '../validation.js';

interface ComponentRequestRow {
  id: string;
  item_id: string;
  user_id: string;
  qty: number;
  note: string | null;
  status: 'menunggu' | 'dikonfirmasi' | 'ditolak';
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  admin_read_at: string | null;
  created_at: string;
}

interface LoanRequestRow {
  id: string;
  item_id: string;
  user_id: string;
  purpose: string;
  expected_return_at: string | null;
  status: 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan';
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  admin_read_at: string | null;
  created_at: string;
}

const COMPONENT_COLUMNS =
  'id, item_id, user_id, qty, note, status, admin_note, decided_by, decided_at, admin_read_at, created_at';
const LOAN_COLUMNS =
  'id, item_id, user_id, purpose, expected_return_at, status, admin_note, decided_by, decided_at, admin_read_at, created_at';

const REQUEST_STATUSES = [
  'menunggu',
  'dikonfirmasi',
  'ditolak',
  'disetujui',
  'dibatalkan',
] as const;

const listSchema = z.object({
  status: z.enum(REQUEST_STATUSES, { message: 'status tidak dikenal' }).optional(),
});

const createComponentSchema = z.object({
  itemId: uuid,
  qty: z.number().int().positive('qty harus bilangan bulat lebih dari 0'),
  note: z.string().trim().max(500).optional(),
});

const createLoanSchema = z.object({
  itemId: uuid,
  purpose: z
    .string()
    .trim()
    .min(3, 'purpose harus 3-500 karakter')
    .max(500, 'purpose harus 3-500 karakter'),
  expectedReturnAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expectedReturnAt harus tanggal YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'expectedReturnAt harus tanggal yang valid',
    })
    .optional(),
});

const rejectSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

type Db = ReturnType<typeof userClient>;

function toComponentRequest(
  row: ComponentRequestRow,
  itemName: string | null,
  requesterName: string | null,
) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName,
    userId: row.user_id,
    requesterName,
    qty: row.qty,
    note: row.note,
    status: row.status,
    adminNote: row.admin_note,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    adminReadAt: row.admin_read_at,
    createdAt: row.created_at,
  };
}

function toLoanRequest(row: LoanRequestRow, itemName: string | null, requesterName: string | null) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName,
    userId: row.user_id,
    requesterName,
    purpose: row.purpose,
    expectedReturnAt: row.expected_return_at,
    status: row.status,
    adminNote: row.admin_note,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    adminReadAt: row.admin_read_at,
    createdAt: row.created_at,
  };
}

/** Maps the stable error codes raised by the inventory request functions. */
function fromRequestRpc(error: { code?: string; message: string }): ApiError {
  switch (error.code) {
    case 'P0001':
      return new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok tidak mencukupi', { cause: error });
    case 'P0002':
      return new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan', { cause: error });
    case 'P0003':
      return new ApiError(409, 'ITEM_UNAVAILABLE', 'Barang sedang tidak tersedia', {
        cause: error,
      });
    case 'P0004':
      return new ApiError(409, 'INVALID_STATE', 'Aksi tidak sesuai status permintaan', {
        cause: error,
      });
    case '42501':
      return new ApiError(403, 'FORBIDDEN', 'Anda tidak berhak melakukan aksi ini', {
        cause: error,
      });
    default:
      return new ApiError(500, 'INTERNAL', 'Terjadi kesalahan pada server', { cause: error });
  }
}

/** Reads item and profile names for a batch of rows in two queries. */
async function names(
  db: Db,
  itemIds: string[],
  userIds: string[],
): Promise<{ items: Map<string, string>; users: Map<string, string> }> {
  const items = new Map<string, string>();
  const users = new Map<string, string>();

  if (itemIds.length > 0) {
    const { data, error } = await db.from('equipment').select('id, name').in('id', itemIds);
    if (error) throw fromDbError(error);
    for (const row of data as { id: string; name: string }[]) items.set(row.id, row.name);
  }
  if (userIds.length > 0) {
    const { data, error } = await db.from('profiles').select('id, full_name').in('id', userIds);
    if (error) throw fromDbError(error);
    for (const row of data as { id: string; full_name: string }[]) users.set(row.id, row.full_name);
  }
  return { items, users };
}

/** Component take-requests and item loan-requests with admin approval. Mounted after `requireAuth`. */
export function requestsRouter(config: Config): Router {
  const router = Router();
  const dbFor = (req: Request) => userClient(config, req.accessToken!);

  router.post(
    '/component-requests',
    requireRole('anggota', 'admin'),
    validate(createComponentSchema),
    async (req, res) => {
      const { itemId, qty, note } = req.body as z.infer<typeof createComponentSchema>;
      const db = dbFor(req);

      const { data: item, error: itemError } = await db
        .from('equipment')
        .select('id, name, kind, quantity')
        .eq('id', itemId)
        .maybeSingle<{ id: string; name: string; kind: string; quantity: number }>();
      if (itemError) throw fromDbError(itemError);
      if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan');
      if (item.kind !== 'komponen') {
        throw new ApiError(400, 'NOT_COMPONENT', 'Item ini bukan komponen habis pakai');
      }
      if (qty > item.quantity) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok tidak mencukupi');
      }

      // user_id always comes from the token, never from the body.
      const { data, error } = await db
        .from('component_requests')
        .insert({ item_id: itemId, user_id: req.user!.id, qty, note: note ?? null })
        .select(COMPONENT_COLUMNS)
        .single<ComponentRequestRow>();
      if (error) throw fromDbError(error);

      const requester = await names(db, [], [req.user!.id]);
      await notifyAdmins(config, {
        kind: 'inventaris',
        message: `${requester.users.get(req.user!.id) ?? 'Anggota'} mengajukan ambil ${item.name} (${qty})`,
      });

      res
        .status(201)
        .json(toComponentRequest(data, item.name, requester.users.get(req.user!.id) ?? null));
    },
  );

  router.get('/component-requests', validate(listSchema, 'query'), async (req, res) => {
    const { status } = req.query as z.infer<typeof listSchema>;
    const db = dbFor(req);

    let query = db.from('component_requests').select(COMPONENT_COLUMNS).order('created_at', {
      ascending: false,
    });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw fromDbError(error);
    const rows = data as ComponentRequestRow[];

    const lookup = await names(
      db,
      [...new Set(rows.map((row) => row.item_id))],
      [...new Set(rows.map((row) => row.user_id))],
    );
    res.json(
      rows.map((row) =>
        toComponentRequest(
          row,
          lookup.items.get(row.item_id) ?? null,
          lookup.users.get(row.user_id) ?? null,
        ),
      ),
    );
  });

  router.patch('/component-requests/:id/confirm', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data, error } = await db.rpc('confirm_component_request', {
      p_request_id: req.params.id,
    });
    if (error) throw fromRequestRpc(error);
    const row = data as ComponentRequestRow;

    const lookup = await names(db, [row.item_id], [row.user_id]);
    const itemName = lookup.items.get(row.item_id) ?? 'item';
    await createNotification(config, {
      userId: row.user_id,
      kind: 'inventaris',
      message: `Laporan ambil ${itemName} (${row.qty}) dikonfirmasi admin`,
    });

    res.json(
      toComponentRequest(
        row,
        lookup.items.get(row.item_id) ?? null,
        lookup.users.get(row.user_id) ?? null,
      ),
    );
  });

  router.patch(
    '/component-requests/:id/reject',
    requireRole('admin'),
    validate(rejectSchema),
    async (req, res) => {
      const { note } = req.body as z.infer<typeof rejectSchema>;
      const db = dbFor(req);

      const { data: current, error: readError } = await db
        .from('component_requests')
        .select(COMPONENT_COLUMNS)
        .eq('id', req.params.id)
        .maybeSingle<ComponentRequestRow>();
      if (readError) throw fromDbError(readError);
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan');
      if (current.status !== 'menunggu') {
        throw new ApiError(409, 'INVALID_STATE', 'Permintaan sudah diputuskan');
      }

      const { data, error } = await db
        .from('component_requests')
        .update({
          status: 'ditolak',
          admin_note: note ?? null,
          decided_by: req.user!.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', current.id)
        .select(COMPONENT_COLUMNS)
        .single<ComponentRequestRow>();
      if (error) throw fromDbError(error);

      const lookup = await names(db, [data.item_id], [data.user_id]);
      const itemName = lookup.items.get(data.item_id) ?? 'item';
      await createNotification(config, {
        userId: data.user_id,
        kind: 'inventaris',
        message: `Laporan ambil ${itemName} (${data.qty}) ditolak admin${note ? `: ${note}` : ''}`,
      });

      res.json(
        toComponentRequest(
          data,
          lookup.items.get(data.item_id) ?? null,
          lookup.users.get(data.user_id) ?? null,
        ),
      );
    },
  );

  router.patch('/component-requests/:id/read', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data, error } = await db
      .from('component_requests')
      .update({ admin_read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(COMPONENT_COLUMNS)
      .maybeSingle<ComponentRequestRow>();
    if (error) throw fromDbError(error);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan');

    const lookup = await names(db, [data.item_id], [data.user_id]);
    res.json(
      toComponentRequest(
        data,
        lookup.items.get(data.item_id) ?? null,
        lookup.users.get(data.user_id) ?? null,
      ),
    );
  });

  router.post(
    '/loan-requests',
    requireRole('anggota', 'admin'),
    validate(createLoanSchema),
    async (req, res) => {
      const { itemId, purpose, expectedReturnAt } = req.body as z.infer<typeof createLoanSchema>;
      const db = dbFor(req);

      const { data: item, error: itemError } = await db
        .from('equipment')
        .select('id, name, kind, status')
        .eq('id', itemId)
        .maybeSingle<{ id: string; name: string; kind: string; status: string }>();
      if (itemError) throw fromDbError(itemError);
      if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item tidak ditemukan');
      if (item.kind !== 'barang') {
        throw new ApiError(400, 'NOT_BARANG', 'Item ini bukan barang satuan');
      }
      if (item.status !== 'tersedia') {
        throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Barang sedang dipinjam');
      }

      const { data, error } = await db
        .from('loan_requests')
        .insert({
          item_id: itemId,
          user_id: req.user!.id,
          purpose,
          expected_return_at: expectedReturnAt ?? null,
        })
        .select(LOAN_COLUMNS)
        .single<LoanRequestRow>();
      if (error) throw fromDbError(error);

      const requester = await names(db, [], [req.user!.id]);
      await notifyAdmins(config, {
        kind: 'inventaris',
        message: `${requester.users.get(req.user!.id) ?? 'Anggota'} mengajukan pinjam ${item.name}`,
      });

      res
        .status(201)
        .json(toLoanRequest(data, item.name, requester.users.get(req.user!.id) ?? null));
    },
  );

  router.get('/loan-requests', validate(listSchema, 'query'), async (req, res) => {
    const { status } = req.query as z.infer<typeof listSchema>;
    const db = dbFor(req);

    let query = db.from('loan_requests').select(LOAN_COLUMNS).order('created_at', {
      ascending: false,
    });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw fromDbError(error);
    const rows = data as LoanRequestRow[];

    const lookup = await names(
      db,
      [...new Set(rows.map((row) => row.item_id))],
      [...new Set(rows.map((row) => row.user_id))],
    );
    res.json(
      rows.map((row) =>
        toLoanRequest(
          row,
          lookup.items.get(row.item_id) ?? null,
          lookup.users.get(row.user_id) ?? null,
        ),
      ),
    );
  });

  router.patch('/loan-requests/:id/approve', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data, error } = await db.rpc('approve_loan_request', {
      p_request_id: req.params.id,
    });
    if (error) throw fromRequestRpc(error);
    const row = data as LoanRequestRow;

    const lookup = await names(db, [row.item_id], [row.user_id]);
    const itemName = lookup.items.get(row.item_id) ?? 'item';
    await createNotification(config, {
      userId: row.user_id,
      kind: 'inventaris',
      message: `Permintaan pinjam ${itemName} disetujui admin`,
    });

    res.json(
      toLoanRequest(
        row,
        lookup.items.get(row.item_id) ?? null,
        lookup.users.get(row.user_id) ?? null,
      ),
    );
  });

  router.patch(
    '/loan-requests/:id/reject',
    requireRole('admin'),
    validate(rejectSchema),
    async (req, res) => {
      const { note } = req.body as z.infer<typeof rejectSchema>;
      const db = dbFor(req);

      const { data: current, error: readError } = await db
        .from('loan_requests')
        .select(LOAN_COLUMNS)
        .eq('id', req.params.id)
        .maybeSingle<LoanRequestRow>();
      if (readError) throw fromDbError(readError);
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan');
      if (current.status !== 'menunggu') {
        throw new ApiError(409, 'INVALID_STATE', 'Permintaan sudah diputuskan');
      }

      const { data, error } = await db
        .from('loan_requests')
        .update({
          status: 'ditolak',
          admin_note: note ?? null,
          decided_by: req.user!.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', current.id)
        .select(LOAN_COLUMNS)
        .single<LoanRequestRow>();
      if (error) throw fromDbError(error);

      const lookup = await names(db, [data.item_id], [data.user_id]);
      const itemName = lookup.items.get(data.item_id) ?? 'item';
      await createNotification(config, {
        userId: data.user_id,
        kind: 'inventaris',
        message: `Permintaan pinjam ${itemName} ditolak admin${note ? `: ${note}` : ''}`,
      });

      res.json(
        toLoanRequest(
          data,
          lookup.items.get(data.item_id) ?? null,
          lookup.users.get(data.user_id) ?? null,
        ),
      );
    },
  );

  router.patch('/loan-requests/:id/cancel', async (req, res) => {
    const db = dbFor(req);

    // RLS hides other users' rows, so existence and ownership are checked with the
    // service client to answer 403 instead of a misleading 404.
    const { data: existing, error: readError } = await serviceClient(config)
      .from('loan_requests')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .maybeSingle<{ id: string; user_id: string; status: string }>();
    if (readError) throw fromDbError(readError);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan');
    if (existing.user_id !== req.user!.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Hanya pemilik permintaan yang dapat membatalkan');
    }
    if (existing.status !== 'menunggu') {
      throw new ApiError(409, 'INVALID_STATE', 'Permintaan sudah diputuskan');
    }

    const { data, error } = await db
      .from('loan_requests')
      .update({ status: 'dibatalkan' })
      .eq('id', existing.id)
      .eq('status', 'menunggu')
      .select(LOAN_COLUMNS)
      .maybeSingle<LoanRequestRow>();
    if (error) throw fromDbError(error);
    if (!data) throw new ApiError(409, 'INVALID_STATE', 'Permintaan sudah diputuskan');

    const lookup = await names(db, [data.item_id], [data.user_id]);
    res.json(
      toLoanRequest(
        data,
        lookup.items.get(data.item_id) ?? null,
        lookup.users.get(data.user_id) ?? null,
      ),
    );
  });

  router.patch('/loan-requests/:id/read', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const { data, error } = await db
      .from('loan_requests')
      .update({ admin_read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(LOAN_COLUMNS)
      .maybeSingle<LoanRequestRow>();
    if (error) throw fromDbError(error);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Permintaan tidak ditemukan');

    const lookup = await names(db, [data.item_id], [data.user_id]);
    res.json(
      toLoanRequest(
        data,
        lookup.items.get(data.item_id) ?? null,
        lookup.users.get(data.user_id) ?? null,
      ),
    );
  });

  router.get('/inventory/pending-count', requireRole('admin'), async (req, res) => {
    const db = dbFor(req);

    const [components, loans] = await Promise.all([
      db
        .from('component_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'menunggu'),
      db
        .from('loan_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'menunggu'),
    ]);
    if (components.error) throw fromDbError(components.error);
    if (loans.error) throw fromDbError(loans.error);

    const componentRequests = components.count ?? 0;
    const loanRequests = loans.count ?? 0;
    res.json({
      componentRequests,
      loanRequests,
      total: componentRequests + loanRequests,
    });
  });

  return router;
}
