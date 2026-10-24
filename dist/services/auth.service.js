"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeUser = revokeUser;
exports.isUserRevoked = isUserRevoked;
exports.loginWithPin = loginWithPin;
exports.verifyAuthToken = verifyAuthToken;
exports.listAllUsers = listAllUsers;
exports.updateUserRole = updateUserRole;
exports.updateUserPermissions = updateUserPermissions;
exports.updateUserPin = updateUserPin;
exports.createUser = createUser;
exports.switchUser = switchUser;
exports.deleteUser = deleteUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../lib/db");
const cache_1 = require("../lib/cache");
const errors_1 = require("../lib/errors");
const client_1 = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET || 'warung-madura-secret-key-24jam';
const JWT_EXPIRES_IN = '24h';
const revokedUserIds = new Set();
function revokeUser(userId) {
    revokedUserIds.add(userId);
    cache_1.cache.set(`user:revoked:${userId}`, true, 86400000);
    cache_1.cache.delete(`user:exists:${userId}`);
}
function isUserRevoked(userId) {
    if (revokedUserIds.has(userId))
        return true;
    if (cache_1.cache.get(`user:revoked:${userId}`))
        return true;
    return false;
}
async function loginWithPin(usernameOrName, pin) {
    const normalized = usernameOrName.trim().toLowerCase();
    // 1. Fast indexed lookup by unique username first (O(1))
    let user = await db_1.db.user.findFirst({
        where: { username: normalized },
    });
    // 2. Fallback to name or case-insensitive if not found by exact username
    if (!user) {
        user = await db_1.db.user.findFirst({
            where: {
                OR: [
                    { username: { equals: normalized, mode: 'insensitive' } },
                    { name: { equals: normalized, mode: 'insensitive' } },
                ],
            },
        });
    }
    if (!user) {
        // C2: Pesan umum agar tidak membocorkan keberadaan username
        throw new errors_1.UnauthorizedError('Nama pengguna atau PIN salah.');
    }
    const isValidPin = await bcryptjs_1.default.compare(pin, user.pinHash);
    if (!isValidPin) {
        // C2: Pesan umum
        throw new errors_1.UnauthorizedError('Nama pengguna atau PIN salah.');
    }
    const payload = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions || [],
        receiverId: user.receiverId,
    };
    const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { token, user: payload };
}
function verifyAuthToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (isUserRevoked(decoded.id)) {
            throw new errors_1.UnauthorizedError('Akun pengguna telah dinonaktifkan atau dihapus.');
        }
        return decoded;
    }
    catch (err) {
        if (err instanceof errors_1.UnauthorizedError)
            throw err;
        throw new errors_1.UnauthorizedError('Token autentikasi tidak valid atau sudah kedaluwarsa.');
    }
}
async function listAllUsers() {
    const cached = cache_1.cache.get('users:all');
    if (cached)
        return cached;
    const users = await db_1.db.user.findMany({
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            receiverId: true,
            createdAt: true,
            receiver: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { role: 'asc' },
    });
    cache_1.cache.set('users:all', users, 30000);
    return users;
}
async function updateUserRole(userId, role) {
    const updated = await db_1.db.user.update({
        where: { id: userId },
        data: { role },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            receiverId: true,
        },
    });
    cache_1.cache.invalidate('users');
    return updated;
}
async function updateUserPermissions(userId, permissions) {
    const updated = await db_1.db.user.update({
        where: { id: userId },
        data: { permissions },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            receiverId: true,
        },
    });
    cache_1.cache.invalidate('users');
    return updated;
}
async function updateUserPin(userId, pin) {
    const pinHash = await bcryptjs_1.default.hash(pin, 10);
    const updated = await db_1.db.user.update({
        where: { id: userId },
        data: { pinHash },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            receiverId: true,
        },
    });
    cache_1.cache.invalidate('users');
    return updated;
}
async function createUser(data) {
    const pinHash = await bcryptjs_1.default.hash(data.pin, 10);
    const created = await db_1.db.user.create({
        data: {
            username: data.username.toLowerCase(),
            name: data.name,
            pinHash,
            role: data.role,
            permissions: data.permissions || [],
            receiverId: data.receiverId || null,
        },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            receiverId: true,
            createdAt: true,
        },
    });
    cache_1.cache.invalidate('users');
    return created;
}
async function switchUser(username) {
    const normalized = username.trim().toLowerCase();
    let user = await db_1.db.user.findFirst({
        where: { username: normalized },
    });
    if (!user) {
        user = await db_1.db.user.findFirst({
            where: {
                username: { equals: normalized, mode: 'insensitive' },
            },
        });
    }
    if (!user) {
        throw new errors_1.UnauthorizedError('Pengguna tidak ditemukan.');
    }
    const payload = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions || [],
        receiverId: user.receiverId,
    };
    const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { token, user: payload };
}
async function deleteUser(targetUserId, currentUserId) {
    // 1. Owner can't delete themselves
    if (targetUserId === currentUserId) {
        throw new errors_1.BadRequestError('Anda tidak dapat menghapus akun Anda sendiri.');
    }
    // 2. Find target user
    let targetUser = null;
    try {
        targetUser = await db_1.db.user.findUnique({
            where: { id: targetUserId },
        });
    }
    catch {
        targetUser = null;
    }
    if (!targetUser) {
        throw new errors_1.NotFoundError('Pengguna tidak ditemukan.');
    }
    // Double check username to prevent deleting self via alternative representation
    let currentUser = null;
    try {
        currentUser = await db_1.db.user.findUnique({
            where: { id: currentUserId },
        });
    }
    catch {
        currentUser = null;
    }
    if (currentUser && currentUser.username.toLowerCase() === targetUser.username.toLowerCase()) {
        throw new errors_1.BadRequestError('Anda tidak dapat menghapus akun Anda sendiri.');
    }
    // 3. If target user is PEMILIK, ensure not the last remaining PEMILIK
    if (targetUser.role === client_1.UserRole.PEMILIK) {
        const ownerCount = await db_1.db.user.count({
            where: { role: client_1.UserRole.PEMILIK },
        });
        if (ownerCount <= 1) {
            throw new errors_1.BadRequestError('Tidak dapat menghapus pemilik terakhir. Sistem harus memiliki minimal satu akun PEMILIK.');
        }
    }
    // 4. Delete user record (Receiver and other models remain intact)
    const deleted = await db_1.db.user.delete({
        where: { id: targetUserId },
    });
    // 5. Instantly revoke any existing tokens for this user and invalidate cache
    revokeUser(targetUserId);
    cache_1.cache.invalidate('users');
    return {
        id: deleted.id,
        username: deleted.username,
        name: deleted.name,
        message: `Pengguna ${deleted.name} (@${deleted.username}) berhasil dihapus.`,
    };
}
