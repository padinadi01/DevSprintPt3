import { Router } from 'express';
import { idParamSchema } from '../validators/common.validator';
import {
  createRoleSchema,
  createUserSchema,
  updatePinSchema,
  updateRoleSchema,
  updateUserSchema,
} from '../validators/auth.validator';
import {
  createRole,
  createUser,
  deleteRole,
  getPermissionCatalog,
  listRoles,
  listUsers,
  resetUserPin,
  updateRole,
  updateUser,
} from '../services/auth.service';

export const accessRouter = Router();

accessRouter.get('/permissions', (_req, res) => {
  res.json(getPermissionCatalog());
});

accessRouter.get('/users', async (_req, res) => {
  res.json(await listUsers());
});

accessRouter.post('/users', async (req, res) => {
  const input = createUserSchema.parse(req.body);
  res.status(201).json(await createUser(input));
});

accessRouter.patch('/users/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body);
  const actorId = req.authUser?.id;
  if (!actorId) throw new Error('Authenticated user missing after authorization.');
  res.json(await updateUser(id, input, actorId));
});

accessRouter.patch('/users/:id/pin', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updatePinSchema.parse(req.body);
  await resetUserPin(id, input);
  res.status(204).send();
});

accessRouter.get('/roles', async (_req, res) => {
  res.json(await listRoles());
});

accessRouter.post('/roles', async (req, res) => {
  const input = createRoleSchema.parse(req.body);
  res.status(201).json(await createRole(input));
});

accessRouter.patch('/roles/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateRoleSchema.parse(req.body);
  res.json(await updateRole(id, input));
});

accessRouter.delete('/roles/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await deleteRole(id);
  res.status(204).send();
});
