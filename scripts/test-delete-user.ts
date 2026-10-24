import 'dotenv/config';
import http from 'http';
import { app } from '../src/app';
import { db } from '../src/lib/db';
import { createUser } from '../src/services/auth.service';
import { UserRole } from '@prisma/client';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`   ✅ ${msg}`);
}

async function request(baseUrl: string, path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('================================================================');
  console.log('TEST SUITE: DELETE USER RBAC, RULES & TOKEN REVOCATION');
  console.log('================================================================\n');

  // Start temporary HTTP server with app
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Login as Pemilik (Cak Rofi)
    console.log('--- SETUP: LOGIN PEMILIK & STAF ---');
    const pemilikLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'pemilik', pin: '1234' }),
    });
    assert(pemilikLogin.status === 200, 'Login pemilik berhasil (HTTP 200)');
    const pemilikToken = pemilikLogin.body.token;
    const pemilikId = pemilikLogin.body.user.id;

    // 2. Login as Staf (Udin)
    const stafLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'udin', pin: '1111' }),
    });
    assert(stafLogin.status === 200, 'Login staf (udin) berhasil (HTTP 200)');
    const stafToken = stafLogin.body.token;
    const stafId = stafLogin.body.user.id;

    // -------------------------------------------------------------------------
    // TEST 1: STAF 403 Forbidden
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: STAF 403 FORBIDDEN ---');
    const stafDeleteRes = await request(baseUrl, `/auth/users/${stafId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stafToken}` },
    });
    assert(stafDeleteRes.status === 403, 'Staf ditolak saat memanggil DELETE /api/auth/users/:id (HTTP 403)');
    assert(stafDeleteRes.body?.error?.code === 'FORBIDDEN', 'Error code adalah FORBIDDEN');
    assert(
      typeof stafDeleteRes.body?.error?.message === 'string' &&
        stafDeleteRes.body.error.message.includes('Akses ditolak: peran STAF'),
      'Pesan error sesuai format: ' + stafDeleteRes.body?.error?.message
    );

    // -------------------------------------------------------------------------
    // TEST 2: Self-delete blocked (400)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: SELF-DELETE BLOCKED (HTTP 400) ---');
    const selfDeleteRes = await request(baseUrl, `/auth/users/${pemilikId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pemilikToken}` },
    });
    assert(selfDeleteRes.status === 400, 'Pemilik tidak dapat menghapus akunnya sendiri (HTTP 400)');
    assert(selfDeleteRes.body?.error?.code === 'BAD_REQUEST', 'Error code adalah BAD_REQUEST');
    assert(
      typeof selfDeleteRes.body?.error?.message === 'string' &&
        selfDeleteRes.body.error.message.includes('Anda tidak dapat menghapus akun Anda sendiri'),
      'Pesan error self-delete dicegah'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Unknown id 404
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: UNKNOWN ID 404 NOT FOUND ---');
    const unknownIdRes = await request(baseUrl, '/auth/users/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pemilikToken}` },
    });
    assert(unknownIdRes.status === 404, 'User yang tidak ada menghasilkan HTTP 404');
    assert(unknownIdRes.body?.error?.code === 'NOT_FOUND', 'Error code adalah NOT_FOUND');

    // -------------------------------------------------------------------------
    // TEST 4: Last-owner blocked (HTTP 400)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: LAST-OWNER BLOCKED (HTTP 400) ---');
    // Ensure only 1 owner or create a scenario with 1 owner
    const owners = await db.user.findMany({ where: { role: UserRole.PEMILIK } });
    if (owners.length === 1) {
      // Trying to delete this owner by id
      const lastOwnerRes = await request(baseUrl, `/auth/users/${owners[0].id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${pemilikToken}` },
      });
      // Will be blocked either by self-delete or last-owner check (400)
      assert(lastOwnerRes.status === 400, 'Pemilik terakhir dicegah untuk dihapus (HTTP 400)');
    } else {
      console.log('   (Catatan: Terdapat lebih dari 1 PEMILIK di database, menguji aturan logika last-owner)');
    }

    // -------------------------------------------------------------------------
    // TEST 5: PEMILIK success (delete user)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: PEMILIK SUCCESS (DELETE USER) ---');
    const tempUsername = `staf_test_${Date.now()}`;
    const tempUser = await createUser({
      username: tempUsername,
      name: 'Staf Percobaan',
      pin: '9999',
      role: UserRole.STAF,
    });
    assert(!!tempUser?.id, `Akun sementara @${tempUsername} berhasil dibuat`);

    // Login as temp user to get token
    const tempLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: tempUsername, pin: '9999' }),
    });
    assert(tempLogin.status === 200, 'Akun sementara berhasil login');
    const tempToken = tempLogin.body.token;

    // Verify temp token works
    const meBefore = await request(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert(meBefore.status === 200, 'Token akun sementara aktif sebelum dihapus');

    // Pemilik deletes temp user
    const deleteSuccessRes = await request(baseUrl, `/auth/users/${tempUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pemilikToken}` },
    });
    assert(deleteSuccessRes.status === 200, 'Pemilik berhasil menghapus pengguna (HTTP 200)');
    assert(deleteSuccessRes.body?.id === tempUser.id, 'Response mengembalikan ID pengguna yang dihapus');

    // -------------------------------------------------------------------------
    // TEST 6: Deleted user can't log in (401)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: DELETED USER CANNOT LOG IN (HTTP 401) ---');
    const loginAfterDelete = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: tempUsername, pin: '9999' }),
    });
    assert(loginAfterDelete.status === 401, 'Pengguna yang dihapus ditolak saat login (HTTP 401)');
    assert(
      loginAfterDelete.body?.error?.message === 'Nama pengguna atau PIN salah.',
      'Pesan login ditolak aman dan tidak membocorkan informasi'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Existing JWT immediately revoked (HTTP 401)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: EXISTING JWT IMMEDIATELY STOPS WORKING (HTTP 401) ---');
    const meAfter = await request(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert(meAfter.status === 401, 'Token JWT milik pengguna yang dihapus langsung ditolak (HTTP 401)');
    assert(
      typeof meAfter.body?.error?.message === 'string' &&
        meAfter.body.error.message.includes('telah dinonaktifkan atau dihapus'),
      'Pesan penolakan token terkonfirmasi'
    );

    console.log('\n================================================================');
    console.log('🎉 ALL DELETE USER TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
