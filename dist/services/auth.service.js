"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithPin = loginWithPin;
exports.verifyAuthToken = verifyAuthToken;
exports.listAllUsers = listAllUsers;
exports.updateUserRole = updateUserRole;
exports.updateUserPermissions = updateUserPermissions;
exports.updateUserPin = updateUserPin;
exports.createUser = createUser;
exports.switchUser = switchUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const JWT_SECRET = process.env.JWT_SECRET || 'warung-madura-secret-key-24jam';
const JWT_EXPIRES_IN = '24h';
async function loginWithPin(usernameOrName, pin) {
    const normalized = usernameOrName.trim().toLowerCase();
    // Find user by username or name (case-insensitive)
    const user = await db_1.db.user.findFirst({
        where: {
            OR: [
                { username: { equals: normalized, mode: 'insensitive' } },
                { name: { equals: normalized, mode: 'insensitive' } },
            ],
        },
    });
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
        return decoded;
    }
    catch {
        throw new errors_1.UnauthorizedError('Token autentikasi tidak valid atau sudah kedaluwarsa.');
    }
}
async function listAllUsers() {
    return db_1.db.user.findMany({
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
}
async function updateUserRole(userId, role) {
    return db_1.db.user.update({
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
}
async function updateUserPermissions(userId, permissions) {
    return db_1.db.user.update({
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
}
async function updateUserPin(userId, pin) {
    const pinHash = await bcryptjs_1.default.hash(pin, 10);
    return db_1.db.user.update({
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
}
async function createUser(data) {
    const pinHash = await bcryptjs_1.default.hash(data.pin, 10);
    return db_1.db.user.create({
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
}
async function switchUser(username) {
    const normalized = username.trim().toLowerCase();
    const user = await db_1.db.user.findFirst({
        where: {
            username: { equals: normalized, mode: 'insensitive' },
        },
    });
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
