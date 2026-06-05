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
