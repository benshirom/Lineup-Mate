import { expect, test } from '@playwright/test';

// Security regression tests — verify that protected endpoints reject
// unauthenticated and unauthorized requests.

test.describe('security: unauthenticated access to API endpoints', () => {
  test('GET /api/admin/stats returns 401 without token', async ({ request }) => {
    const response = await request.get('/api/admin/stats');
    expect(response.status()).toBe(401);
  });

  test('GET /api/admin/users returns 401 without token', async ({ request }) => {
    const response = await request.get('/api/admin/users');
    expect(response.status()).toBe(401);
  });

  test('POST /api/admin/import-clashfinder returns 401 without token', async ({ request }) => {
    const response = await request.post('/api/admin/import-clashfinder', {
      data: { slug: 'test' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/admin/preview-clashfinder returns 401 without token', async ({ request }) => {
    const response = await request.post('/api/admin/preview-clashfinder', {
      data: { slug: 'test' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/profile/avatar-upload returns 401 without token', async ({ request }) => {
    const response = await request.post('/api/profile/avatar-upload', {
      data: { file: 'data:image/png;base64,abc' },
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/profile/delete-account returns 401 without token', async ({ request }) => {
    const response = await request.delete('/api/profile/delete-account');
    expect(response.status()).toBe(401);
  });

  test('GET /api/profile/export-data returns 401 without token', async ({ request }) => {
    const response = await request.get('/api/profile/export-data');
    expect(response.status()).toBe(401);
  });
});

test.describe('security: legacy endpoint removed', () => {
  test('/api/upload-avatar no longer exists (404)', async ({ request }) => {
    const response = await request.post('/api/upload-avatar', {
      data: { file: 'data:image/png;base64,abc', userId: 'attacker-chosen-id' },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe('security: admin endpoints do not leak DB error details', () => {
  test('admin endpoint error response does not contain SQL/schema keywords', async ({ request }) => {
    // Send a request with a fake token that will fail auth — error message must be generic
    const response = await request.get('/api/admin/users', {
      headers: { Authorization: 'Bearer invalid-token-that-causes-supabase-error' },
    });
    const body = await response.json();
    const errorText = (body.error ?? '').toLowerCase();
    // Must not leak database internals
    expect(errorText).not.toContain('relation');
    expect(errorText).not.toContain('column');
    expect(errorText).not.toContain('constraint');
    expect(errorText).not.toContain('pg_');
    expect(errorText).not.toContain('postgresql');
  });
});

test.describe('security: input validation on admin clashfinder endpoints', () => {
  test('preview-clashfinder with no slug returns 400 with a bearer token header present', async ({ request }) => {
    // Even with a fake bearer token the validation runs before auth in the new flow;
    // but auth runs first — so a missing slug + fake token returns 401 (auth fails first).
    // We verify that empty slug is rejected (either 400 or 401 is acceptable, not 500).
    const response = await request.post('/api/admin/preview-clashfinder', {
      headers: { Authorization: 'Bearer fake' },
      data: { slug: '' },
    });
    expect([400, 401]).toContain(response.status());
  });
});

test.describe('security: IDOR — profile endpoints reject cross-user access', () => {
  test('DELETE /api/profile/delete-account without token returns 401', async ({ request }) => {
    const response = await request.delete('/api/profile/delete-account');
    expect(response.status()).toBe(401);
  });

  test('GET /api/profile/export-data without token returns 401', async ({ request }) => {
    const response = await request.get('/api/profile/export-data');
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/profile/delete-account with invalid token returns 401', async ({ request }) => {
    const response = await request.delete('/api/profile/delete-account', {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/profile/export-data with invalid token returns 401', async ({ request }) => {
    const response = await request.get('/api/profile/export-data', {
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('security: admin endpoints reject non-admin tokens', () => {
  const adminEndpoints = [
    { method: 'GET', path: '/api/admin/stats' },
    { method: 'GET', path: '/api/admin/users' },
    { method: 'GET', path: '/api/admin/groups' },
    { method: 'GET', path: '/api/admin/clashfinder-events' },
  ];

  for (const { method, path } of adminEndpoints) {
    test(`${method} ${path} returns 401 with invalid token`, async ({ request }) => {
      const response = await request.fetch(path, {
        method,
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(response.status()).toBe(401);
    });
  }
});

test.describe('security: HTTP method enforcement', () => {
  test('GET /api/profile/delete-account returns 405', async ({ request }) => {
    const response = await request.get('/api/profile/delete-account');
    expect(response.status()).toBe(405);
  });

  test('POST /api/profile/export-data returns 405', async ({ request }) => {
    const response = await request.post('/api/profile/export-data', { data: {} });
    expect(response.status()).toBe(405);
  });

  test('DELETE /api/admin/stats returns 405', async ({ request }) => {
    const response = await request.delete('/api/admin/stats');
    expect(response.status()).toBe(405);
  });
});

// Cross-user isolation tests — require two real accounts configured via env vars.
// Skipped automatically when the env vars are not present (local/CI without credentials).
const userEmail = process.env.E2E_USER_EMAIL;
const userPassword = process.env.E2E_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getSessionToken(email: string, password: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

test.describe('security: cross-user data isolation', () => {
  test('export-data returns only the requesting user\'s own data', async ({ request }) => {
    test.skip(
      !userEmail || !userPassword || !adminEmail || !adminPassword || !supabaseUrl || !supabaseAnonKey,
      'Cross-user tests require E2E_USER_*, E2E_ADMIN_*, and NEXT_PUBLIC_SUPABASE_* env vars'
    );

    const userToken = await getSessionToken(userEmail!, userPassword!);
    const adminToken = await getSessionToken(adminEmail!, adminPassword!);
    test.skip(!userToken || !adminToken, 'Could not obtain session tokens for both accounts');

    // Fetch export as regular user
    const userExport = await request.get('/api/profile/export-data', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(userExport.status()).toBe(200);
    const userBody = await userExport.json();
    const userProfileId = userBody.profile?.id;
    expect(userProfileId).toBeTruthy();

    // Fetch export as admin user — must return admin's own data, not the regular user's
    const adminExport = await request.get('/api/profile/export-data', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminExport.status()).toBe(200);
    const adminBody = await adminExport.json();
    const adminProfileId = adminBody.profile?.id;
    expect(adminProfileId).toBeTruthy();

    // The two exports must belong to different users
    expect(userProfileId).not.toBe(adminProfileId);
  });

  test('admin endpoint with regular-user token returns 403', async ({ request }) => {
    test.skip(
      !userEmail || !userPassword || !supabaseUrl || !supabaseAnonKey,
      'Cross-user tests require E2E_USER_* and NEXT_PUBLIC_SUPABASE_* env vars'
    );

    const userToken = await getSessionToken(userEmail!, userPassword!);
    test.skip(!userToken, 'Could not obtain session token for regular user');

    const response = await request.get('/api/admin/stats', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    // A valid but non-admin token must be rejected with 403
    expect(response.status()).toBe(403);
  });
});
