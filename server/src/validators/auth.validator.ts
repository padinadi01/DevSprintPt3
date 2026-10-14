import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung')
  .transform((value) => value.toLowerCase());

export const pinSchema = z
  .string()
  .regex(/^\d{4,12}$/, 'PIN harus terdiri dari 4 sampai 12 angka');

export const setupSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80),
  pin: pinSchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  pin: pinSchema,
});

export const createUserSchema = setupSchema.extend({
  roleId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  roleId: z.string().uuid().optional(),
  permissions: z.array(z.string()).max(30).nullable().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'Tidak ada data yang diubah',
});

export const updatePinSchema = z.object({ pin: pinSchema });

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(40),
  permissions: z.array(z.string()).max(30),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  permissions: z.array(z.string()).max(30).optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'Tidak ada data yang diubah',
});
