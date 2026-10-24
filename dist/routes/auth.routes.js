"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_service_1 = require("../services/auth.service");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Nama pengguna wajib diisi'),
    pin: zod_1.z.string().min(1, 'PIN wajib diisi'),
});
// C2 & C7: Login dengan PIN + Batas percobaan gagal
exports.authRouter.post('/login', async (req, res, next) => {
    try {
        const input = loginSchema.parse(req.body);
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const rateLimitKey = `${ip}:${input.username.toLowerCase()}`;
        // C7: Batas percobaan login
        (0, auth_middleware_1.checkLoginRateLimit)(rateLimitKey);
        try {
            const result = await (0, auth_service_1.loginWithPin)(input.username, input.pin);
            (0, auth_middleware_1.clearFailedLogin)(rateLimitKey);
            res.json(result);
        }
        catch (err) {
            (0, auth_middleware_1.recordFailedLogin)(rateLimitKey);
            throw err;
        }
    }
    catch (error) {
        next(error);
    }
});
// Profil akun yang sedang login
exports.authRouter.get('/me', auth_middleware_1.authenticate, (req, res) => {
    res.json({ user: req.user });
});
// Daftar pengguna untuk master control (Pemilik Only)
exports.authRouter.get('/users', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (_req, res, next) => {
    try {
        const users = await (0, auth_service_1.listAllUsers)();
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
// RBAC Master Control Specification & Matrix definition (Pemilik Only)
exports.authRouter.get('/rbac-matrix', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), (req, res) => {
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
exports.authRouter.patch('/users/:id/role', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const roleSchema = zod_1.z.object({
            role: zod_1.z.nativeEnum(client_1.UserRole),
        });
        const { role } = roleSchema.parse(req.body);
        const updated = await (0, auth_service_1.updateUserRole)(id, role);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// Master Control: Ubah PIN pengguna (Pemilik Only)
exports.authRouter.patch('/users/:id/pin', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const pinSchema = zod_1.z.object({
            pin: zod_1.z.string().min(4, 'PIN minimal 4 karakter/angka'),
        });
        const { pin } = pinSchema.parse(req.body);
        const updated = await (0, auth_service_1.updateUserPin)(id, pin);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// Master Control: Tambah pengguna baru (Pemilik Only)
exports.authRouter.post('/users', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (req, res, next) => {
    try {
        const createUserSchema = zod_1.z.object({
            username: zod_1.z.string().min(2, 'Username minimal 2 karakter'),
            name: zod_1.z.string().min(2, 'Nama minimal 2 karakter'),
            pin: zod_1.z.string().min(4, 'PIN minimal 4 angka'),
            role: zod_1.z.nativeEnum(client_1.UserRole),
            receiverId: zod_1.z.string().uuid().optional().nullable(),
        });
        const input = createUserSchema.parse(req.body);
        const created = await (0, auth_service_1.createUser)(input);
        res.status(201).json(created);
    }
    catch (error) {
        next(error);
    }
});
// Master Control: Ubah hak akses (permissions) staf (Pemilik Only)
exports.authRouter.patch('/users/:id/permissions', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const permissionsSchema = zod_1.z.object({
            permissions: zod_1.z.array(zod_1.z.string()),
        });
        const { permissions } = permissionsSchema.parse(req.body);
        const updated = await (0, auth_service_1.updateUserPermissions)(id, permissions);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
// Master Control: Hapus akun pengguna (Pemilik Only)
exports.authRouter.delete('/users/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(client_1.UserRole.PEMILIK), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const currentUserId = req.user.id;
        const result = await (0, auth_service_1.deleteUser)(id, currentUserId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Quick Switch (Master Control / Switcher): Langsung beralih akun untuk demonstrasi RBAC
exports.authRouter.post('/switch', async (req, res, next) => {
    try {
        const { username } = zod_1.z.object({ username: zod_1.z.string().min(1) }).parse(req.body);
        const result = await (0, auth_service_1.switchUser)(username);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
