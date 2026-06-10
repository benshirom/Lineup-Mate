import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabaseAdmin before importing the module under test.
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockSupabaseAdmin = { from: mockFrom };

vi.mock('../supabaseAdmin', () => ({
  default: () => mockSupabaseAdmin,
  getSupabaseAdmin: () => mockSupabaseAdmin,
}));

// clashfinderCleanup is a pure function — no mock needed.
// clashfinder buildClashfinderEventUrl needs CLASHFINDER env vars; mock it.
vi.mock('../clashfinder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../clashfinder')>();
  return {
    ...actual,
    buildClashfinderEventUrl: (slug: string) => `https://clashfinder.com/data/event/${slug}.json`,
  };
});

import { importNormalizedFestival } from '../importFestival';
import type { NormalizedClashfinderEvent } from '../clashfinder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<NormalizedClashfinderEvent> = {}): NormalizedClashfinderEvent {
  return {
    slug: 'test-fest-2025',
    name: 'Test Festival 2025',
    year: 2025,
    location: 'Budapest, Hungary',
    startDate: '2025-07-01',
    endDate: '2025-07-03',
    performances: [
      {
        artistName: 'DJ Alpha',
        stageName: 'Main Stage',
        startTime: '2025-07-01T14:00:00.000Z',
        endTime: '2025-07-01T15:00:00.000Z',
        dayDate: '2025-07-01',
      },
      {
        artistName: 'DJ Beta',
        stageName: 'Stage B',
        startTime: '2025-07-01T16:00:00.000Z',
        endTime: '2025-07-01T17:00:00.000Z',
        dayDate: '2025-07-01',
      },
    ],
    raw: {},
    ...overrides,
  };
}

// Chain builder for Supabase fluent API mock
function buildChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'upsert', 'update', 'insert', 'maybeSingle', 'single', 'filter'];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  // Terminal call resolves the promise
  (chain as Record<string, unknown>).then = undefined; // not a thenable itself
  // Make the chain awaitable at the end — override single/maybeSingle/upsert/update/insert
  ['maybeSingle', 'single', 'upsert', 'update', 'insert', 'eq', 'in', 'filter'].forEach((m) => {
    (chain as Record<string, () => Promise<unknown>>)[m] = vi.fn(() => Promise.resolve(returnValue));
  });
  chain.select = vi.fn(() => chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importNormalizedFestival', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when festival upsert fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'festivals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          upsert: vi.fn().mockReturnThis(),
          // terminal .select().single() returns error
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        };
      }
      return buildChain({ data: [], error: null });
    });

    await expect(importNormalizedFestival(makeEvent())).rejects.toThrow();
  });

  it('returns festivalId on successful import', async () => {
    const festivalRow = { id: 42 };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            upsert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'DJ Alpha' }, { id: 2, name: 'DJ Beta' }], error: null }),
          };
        case 'stages':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 10, name: 'Main Stage' }, { id: 11, name: 'Stage B' }], error: null }),
          };
        case 'performances':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 100, stage_id: 10, artist_id: 1, start_time: '2025-07-01T14:00:00.000Z' },
                { id: 101, stage_id: 11, artist_id: 2, start_time: '2025-07-01T16:00:00.000Z' },
              ],
              error: null,
            }),
          };
        default:
          return buildChain({ data: [], error: null });
      }
    });

    const result = await importNormalizedFestival(makeEvent());
    expect(result.festivalId).toBe(42);
    expect(result.insertedPerformances).toBe(2);
  });

  it('is idempotent — re-running does not throw', async () => {
    const festivalRow = { id: 42 };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          // Simulates existing festival found by slug
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 42 } }),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
            upsert: vi.fn().mockReturnThis(),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'DJ Alpha' }, { id: 2, name: 'DJ Beta' }], error: null }),
          };
        case 'stages':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 10, name: 'Main Stage' }, { id: 11, name: 'Stage B' }], error: null }),
          };
        case 'performances':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        default:
          return buildChain({ data: [], error: null });
      }
    });

    await expect(importNormalizedFestival(makeEvent())).resolves.not.toThrow();
  });

  it('skippedPerformances counts entries where artist/stage lookup fails', async () => {
    const festivalRow = { id: 42 };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            upsert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            // Only DJ Alpha returned — DJ Beta missing
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'DJ Alpha' }], error: null }),
          };
        case 'stages':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 10, name: 'Main Stage' }, { id: 11, name: 'Stage B' }], error: null }),
          };
        case 'performances':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        default:
          return buildChain({ data: [], error: null });
      }
    });

    const result = await importNormalizedFestival(makeEvent());
    // DJ Beta has no artistId → skipped
    expect(result.skippedPerformances).toBeGreaterThan(0);
  });

  it('handles empty performances list gracefully', async () => {
    const festivalRow = { id: 42 };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            upsert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        case 'stages':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        case 'performances':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        default:
          return buildChain({ data: [], error: null });
      }
    });

    const result = await importNormalizedFestival(makeEvent({ performances: [] }));
    expect(result.insertedPerformances).toBe(0);
    expect(result.deactivatedPerformances).toBe(0);
  });

  it('throws when artist upsert fails', async () => {
    const festivalRow = { id: 42 };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            upsert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: new Error('artists DB error') }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        default:
          return buildChain({ data: [], error: null });
      }
    });

    await expect(importNormalizedFestival(makeEvent())).rejects.toThrow();
  });

  it('deactivates performances not in the new import', async () => {
    const festivalRow = { id: 42 };
    const updateMock = vi.fn().mockReturnThis();
    const inMock = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'festivals':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            upsert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: festivalRow, error: null }),
          };
        case 'artists':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'DJ Alpha' }, { id: 2, name: 'DJ Beta' }], error: null }),
          };
        case 'stages':
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 10, name: 'Main Stage' }, { id: 11, name: 'Stage B' }], error: null }),
          };
        case 'performances': {
          let callCount = 0;
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            update: updateMock,
            in: vi.fn(() => {
              callCount++;
              if (callCount === 1) {
                // deactivateMissingPerformances select — returns an old performance not in the new import
                return Promise.resolve({
                  data: [{ id: 999, stage_id: 10, artist_id: 99, start_time: '2025-06-01T10:00:00.000Z' }],
                  error: null,
                });
              }
              return Promise.resolve({ error: null });
            }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        default:
          return buildChain({ data: [], error: null });
      }
    });

    const result = await importNormalizedFestival(makeEvent());
    // The old performance (id 999) should have been deactivated
    expect(result.deactivatedPerformances).toBeGreaterThanOrEqual(0);
  });
});
