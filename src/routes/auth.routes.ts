import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import {
  clearFailedLogin,
  checkLoginRateLimit,
  recordFailedLogin,
  authenticate,
  requireRole,
} from '../middleware/auth.middleware';
import {
  listAllUsers,
  loginWithPin,
  updateUserRole,
  updateUserPermissions,
  updateUserPin,
  createUser,
  deleteUser,
  switchUser,
} from '../services/auth.service';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Nama pengguna wajib diisi'),
  pin: z.string().min(1, 'PIN wajib diisi'),
});

// C2 & C7: Login dengan PIN + Batas percobaan gagal
authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${ip}:${input.username.toLowerCase()}`;

    // C7: Batas percobaan login
    checkLoginRateLimit(rateLimitKey);

    try {
      const result = await loginWithPin(input.username, input.pin);
      clearFailedLogin(rateLimitKey);
      res.json(result);
    } catch (err) {
      recordFailedLogin(rateLimitKey);
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// Profil akun yang sedang login
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Daftar pengguna untuk master control (Pemilik Only)
authRouter.get('/users', authenticate, requireRole(UserRole.PEMILIK), async (_req, res, next) => {
  try {
    const users = await listAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// RBAC Master Control Specification & Matrix definition (Pemilik Only)
authRouter.get('/rbac-matrix', authenticate, requireRole(UserRole.PEMILIK), (req, res) => {
  const matrix = [
    {
      action: 'Lihat stok dan riwayat',
      module: 'Inventori',
      endpoint: 'GET /api/products, GET /api/stock-movements',
      pemilik: 'Boleh',
      staf: 'Boleh',
      description: 'Kasir dan Pemilik dapat melihat sisa stok dasar (bungkus, sachet)',
    },
    {
      action: 'Terima barang',
      module: 'Penerimaan',
      endpoint: 'POST /api/goods-receipts',
      pemilik: 'Boleh',
      staf: 'Boleh, atas nama dirinya',
      description: 'Identitas penerima dipaksa dari sesi login staf, bukan dari body',
    },
    {
      action: 'Buat / tutup pesanan (PO)',
      module: 'Pengadaan',
      endpoint: 'POST /api/purchase-orders, PATCH /api/purchase-orders/:id/cancel',
      pemilik: 'Boleh',
      staf: 'Ditolak (403)',
      description: 'Hanya Pemilik yang boleh membuat PO atau membatalkan pesanan',
    },
    {
      action: 'Koreksi stok',
      module: 'Inventori',
      endpoint: 'POST /api/stock-adjustments',
      pemilik: 'Boleh',
      staf: 'Ditolak (403)',
      description: 'Penyesuaian stok langsung ditolak untuk Staf untuk mencegah selisih fiktif',
    },
    {
      action: 'Kelola produk, harga, staf',
      module: 'Katalog',
      endpoint: 'POST /api/products, PATCH /api/products/:id, DELETE /api/products/:id',
      pemilik: 'Boleh',
      staf: 'Ditolak (403)',
      description: 'Hanya Pemilik yang boleh menambah produk, mengubah harga, atau menghapus',
    },
    {
      action: 'Lihat harga modal',
      module: 'Kerahasiaan',
      endpoint: 'GET /api/products, GET /api/goods-receipts/:id',
      pemilik: 'Boleh',
      staf: 'Tidak tampil di response',
      description: 'Field purchasePrice dan unitCost otomatis dihilangkan dari respon Staf',
    },
  ];

  res.json({
    role: req.user?.role,
    matrix,
    principles: [
      'Deny by default: yang tidak ditulis, ditolak',
      'Izin per peran, bukan per orang',
      'Berlaku juga untuk data (harga modal tidak tampil di response)',
    ],
  });
});

// Master Control: Ubah peran pengguna (Pemilik Only)
authRouter.patch('/users/:id/role', authenticate, requireRole(UserRole.PEMILIK), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const roleSchema = z.object({
      role: z.nativeEnum(UserRole),
    });
    const { role } = roleSchema.parse(req.body);
    const updated = await updateUserRole(id, role);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Master Control: Ubah PIN pengguna (Pemilik Only)
authRouter.patch('/users/:id/pin', authenticate, requireRole(UserRole.PEMILIK), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const pinSchema = z.object({
      pin: z.string().min(4, 'PIN minimal 4 karakter/angka'),
    });
    const { pin } = pinSchema.parse(req.body);
    const updated = await updateUserPin(id, pin);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Master Control: Tambah pengguna baru (Pemilik Only)
authRouter.post('/users', authenticate, requireRole(UserRole.PEMILIK), async (req, res, next) => {
  try {
    const createUserSchema = z.object({
      username: z.string().min(2, 'Username minimal 2 karakter'),
      name: z.string().min(2, 'Nama minimal 2 karakter'),
      pin: z.string().min(4, 'PIN minimal 4 angka'),
      role: z.nativeEnum(UserRole),
      receiverId: z.string().uuid().optional().nullable(),
    });
    const input = createUserSchema.parse(req.body);
    const created = await createUser(input);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// Master Control: Ubah hak akses (permissions) staf (Pemilik Only)
authRouter.patch('/users/:id/permissions', authenticate, requireRole(UserRole.PEMILIK), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const permissionsSchema = z.object({
      permissions: z.array(z.string()),
    });
    const { permissions } = permissionsSchema.parse(req.body);
    const updated = await updateUserPermissions(id, permissions);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Master Control: Hapus akun pengguna (Pemilik Only)
authRouter.delete('/users/:id', authenticate, requireRole(UserRole.PEMILIK), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const currentUserId = req.user!.id;
    const result = await deleteUser(id, currentUserId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Quick Switch (Master Control / Switcher): Langsung beralih akun untuk demonstrasi RBAC
authRouter.post('/switch', async (req, res, next) => {
  try {
    const { username } = z.object({ username: z.string().min(1) }).parse(req.body);
    const result = await switchUser(username);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

