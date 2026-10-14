import { request } from './http';
import type { AppUser } from './auth';

export interface AccessRole {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export interface AccessPermission {
  key: string;
  label: string;
}

export interface ManagedUser extends AppUser {
  createdAt: string;
  usesRolePermissions: boolean;
}

export const listAccessUsers = () => request<ManagedUser[]>('/access/users');
export const listAccessRoles = () => request<AccessRole[]>('/access/roles');
export const listAccessPermissions = () => request<AccessPermission[]>('/access/permissions');

export function addAccessUser(input: {
  username: string;
  displayName: string;
  pin: string;
  roleId: string;
}) {
  return request<ManagedUser>('/access/users', { method: 'POST', body: input });
}

export function editAccessUser(id: string, input: {
  username?: string;
  displayName?: string;
  roleId?: string;
  permissions?: string[] | null;
  isActive?: boolean;
}) {
  return request<ManagedUser>(`/access/users/${id}`, { method: 'PATCH', body: input });
}

export function resetAccessPin(id: string, pin: string) {
  return request<void>(`/access/users/${id}/pin`, { method: 'PATCH', body: { pin } });
}

export function addAccessRole(input: { name: string; permissions: string[] }) {
  return request<AccessRole>('/access/roles', { method: 'POST', body: input });
}

export function editAccessRole(id: string, input: { name?: string; permissions?: string[] }) {
  return request<AccessRole>(`/access/roles/${id}`, { method: 'PATCH', body: input });
}

export function removeAccessRole(id: string) {
  return request<void>(`/access/roles/${id}`, { method: 'DELETE' });
}
