import { request } from './http';

export type UserRole = 'PEMILIK' | 'STAF';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  receiverId: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface UserListItem {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  receiverId: string | null;
  createdAt: string;
  receiver?: {
    id: string;
    name: string;
  } | null;
}

export interface RbacMatrixItem {
  action: string;
  module: string;
  endpoint: string;
  pemilik: string;
  staf: string;
  description: string;
}

export interface RbacMatrixResponse {
  role?: UserRole;
  matrix: RbacMatrixItem[];
  principles: string[];
}

export function apiLogin(username: string, pin: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { username, pin },
  });
}

export function apiQuickSwitch(username: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/switch', {
    method: 'POST',
    body: { username },
  });
}

export function apiGetMe(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/auth/me');
}

export function apiListUsers(): Promise<UserListItem[]> {
  return request<UserListItem[]>('/auth/users');
}

export function apiGetRbacMatrix(): Promise<RbacMatrixResponse> {
  return request<RbacMatrixResponse>('/auth/rbac-matrix');
}

export function apiUpdateUserRole(userId: string, role: UserRole): Promise<AuthUser> {
  return request<AuthUser>(`/auth/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function apiUpdateUserPin(userId: string, pin: string): Promise<AuthUser> {
  return request<AuthUser>(`/auth/users/${userId}/pin`, {
    method: 'PATCH',
    body: { pin },
  });
}

export function apiUpdateUserPermissions(userId: string, permissions: string[]): Promise<AuthUser> {
  return request<AuthUser>(`/auth/users/${userId}/permissions`, {
    method: 'PATCH',
    body: { permissions },
  });
}

export const PERMISSIONS_DEF = [
  {
    key: 'VIEW_DASHBOARD',
    label: 'Akses Dashboard & Laba',
    description: 'Melihat ringkasan total aset, omset, dan laba kotor warung',
    badge: '📊 Dashboard',
  },
  {
    key: 'CREATE_PO',
    label: 'Buat Purchase Order (PO)',
    description: 'Membuat pesanan barang baru ke supplier',
    badge: '📝 Buat PO',
  },
  {
    key: 'CANCEL_PO',
    label: 'Batalkan Purchase Order (PO)',
    description: 'Membatalkan PO yang masih berstatus OPEN/DRAFT',
    badge: '🚫 Batal PO',
  },
  {
    key: 'ADJUST_STOCK',
    label: 'Koreksi Stok (Stock Opname)',
    description: 'Menyesuaikan jumlah stok fisik dan riwayat penyesuaian',
    badge: '⚖️ Opname',
  },
  {
    key: 'VIEW_COST',
    label: 'Lihat Harga Modal Supplier',
    description: 'Melihat rincian harga beli per dus/satuan dan total biaya belanja',
    badge: '💰 Harga Modal',
  },
  {
    key: 'MANAGE_PRODUCTS',
    label: 'Kelola Katalog Produk',
    description: 'Menambah, mengedit, atau menghapus data master produk warung',
    badge: '📦 Kelola Produk',
  },
  {
    key: 'REVERSE_RECEIPT',
    label: 'Batalkan / Reversal Penerimaan',
    description: 'Membuat jurnal balik pembatalan penerimaan barang',
    badge: '🔄 Reversal GR',
  },
] as const;

export function apiCreateUser(data: {
  username: string;
  name: string;
  pin: string;
  role: UserRole;
  receiverId?: string | null;
}): Promise<UserListItem> {
  return request<UserListItem>('/auth/users', {
    method: 'POST',
    body: data,
  });
}
