import { request } from './http';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  permissions: string[];
  isImpersonating: boolean;
  role: {
    id: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
  };
}

export interface AuthSessionResponse {
  user: AppUser;
  expiresAt?: string;
}

export function getSession(): Promise<{ user: AppUser }> {
  return request<{ user: AppUser }>('/auth/session');
}

export function getSetupStatus(): Promise<{ setupRequired: boolean }> {
  return request<{ setupRequired: boolean }>('/auth/setup-status');
}

export function login(input: { username: string; pin: string }): Promise<AuthSessionResponse> {
  return request<AuthSessionResponse>('/auth/login', { method: 'POST', body: input });
}

export function setupOwner(input: {
  username: string;
  displayName: string;
  pin: string;
}): Promise<AuthSessionResponse> {
  return request<AuthSessionResponse>('/auth/setup', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function quickSwitch(targetUserId: string): Promise<{ user: AppUser }> {
  return request<{ user: AppUser }>(`/auth/quick-switch/${targetUserId}`, { method: 'POST' });
}

export function returnToOwner(): Promise<{ user: AppUser }> {
  return request<{ user: AppUser }>('/auth/quick-switch/return', { method: 'POST' });
}
