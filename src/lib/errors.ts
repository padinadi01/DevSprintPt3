// Errors thrown by services. The error handler middleware turns them into HTTP responses.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autentikasi diperlukan. Silakan login terlebih dahulu.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Akses ditolak: peran Anda tidak memiliki izin untuk aksi ini.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Terlalu banyak permintaan. Silakan coba lagi nanti.') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}
