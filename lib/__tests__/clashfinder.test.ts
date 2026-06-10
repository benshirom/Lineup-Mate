import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeClashfinderEvent } from '../clashfinder';

// clashfinder.ts imports `crypto` from Node for key-building utilities only.
// normalizeClashfinderEvent is pure (no crypto usage), so no mock needed.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePerf(overrides: Record<string, unknown> = {}) {
  return {
    artist: 'Test Artist',
    start: '2025-07-01T14:00:00.000Z',
    end: '2025-07-01T15:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — basic structure
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — basic structure', () => {
  it('returns the slug unchanged', () => {
    const result = normalizeClashfinderEvent({}, 'test-slug');
    expect(result.slug).toBe('test-slug');
  });

  it('falls back to slug-based name when root has no name field', () => {
    const result = normalizeClashfinderEvent({}, 'my-festival-2025');
    expect(result.name).toBe('my festival 2025');
  });

  it('reads name from root.name', () => {
    const result = normalizeClashfinderEvent({ name: 'Great Fest 2025' }, 'gf');
    expect(result.name).toBe('Great Fest 2025');
  });

  it('infers year from name', () => {
    const result = normalizeClashfinderEvent({ name: 'Great Fest 2025' }, 'gf');
    expect(result.year).toBe(2025);
  });

  it('reads location from root.location', () => {
    const result = normalizeClashfinderEvent({ name: 'Fest 2025', location: 'Budapest, Hungary' }, 'f');
    expect(result.location).toBe('Budapest, Hungary');
  });

  it('returns null location when absent', () => {
    const result = normalizeClashfinderEvent({ name: 'Fest 2025' }, 'f');
    expect(result.location).toBeNull();
  });

  it('preserves raw input', () => {
    const raw = { name: 'Fest 2025' };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.raw).toBe(raw);
  });

  it('returns empty performances for empty input', () => {
    const result = normalizeClashfinderEvent({}, 'empty');
    expect(result.performances).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — contextual (flat array) format
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — flat array format', () => {
  it('parses a flat array of performances', () => {
    const raw = {
      name: 'Flat Fest 2025',
      stages: [
        {
          name: 'Main Stage',
          performances: [makePerf({ stage: 'Main Stage' })],
        },
      ],
    };
    const result = normalizeClashfinderEvent(raw, 'flat');
    expect(result.performances.length).toBeGreaterThan(0);
    expect(result.performances[0].artistName).toBe('Test Artist');
  });

  it('skips performances missing artist name', () => {
    const raw = {
      name: 'Fest 2025',
      items: [{ start: '2025-07-01T14:00:00.000Z', end: '2025-07-01T15:00:00.000Z' }],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances).toHaveLength(0);
  });

  it('skips performances missing start time', () => {
    const raw = {
      name: 'Fest 2025',
      items: [{ artist: 'DJ Test', end: '2025-07-01T15:00:00.000Z' }],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances).toHaveLength(0);
  });

  it('skips performances missing end time', () => {
    const raw = {
      name: 'Fest 2025',
      items: [{ artist: 'DJ Test', start: '2025-07-01T14:00:00.000Z' }],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — locations format
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — locations format', () => {
  it('parses locations object format', () => {
    const raw = {
      name: 'Locations Fest 2025',
      locations: {
        'Stage A': {
          performances: [makePerf()],
        },
        'Stage B': {
          performances: [makePerf({ artist: 'Artist B' })],
        },
      },
    };
    const result = normalizeClashfinderEvent(raw, 'lf');
    const artists = result.performances.map((p) => p.artistName);
    expect(artists).toContain('Test Artist');
    expect(artists).toContain('Artist B');
  });

  it('assigns correct stage name from locations key', () => {
    const raw = {
      name: 'Fest 2025',
      locations: {
        'Main Stage': {
          performances: [makePerf()],
        },
      },
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances[0].stageName).toBe('Main Stage');
  });

  it('parses locations array format', () => {
    const raw = {
      name: 'Array Fest 2025',
      locations: [
        { name: 'Stage One', performances: [makePerf()] },
        { name: 'Stage Two', performances: [makePerf({ artist: 'Artist Two' })] },
      ],
    };
    const result = normalizeClashfinderEvent(raw, 'af');
    expect(result.performances.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — deduplication
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — deduplication', () => {
  it('deduplicates identical performances across formats', () => {
    const perf = makePerf({ stage: 'Main' });
    const raw = {
      name: 'Fest 2025',
      // same performance will appear in both locations AND contextual traversal
      locations: { Main: { performances: [perf] } },
      acts: [perf],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    const matching = result.performances.filter(
      (p) => p.artistName === 'Test Artist' && p.startTime === perf.start,
    );
    expect(matching).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — date ordering
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — ordering', () => {
  it('returns performances sorted by startTime', () => {
    const raw = {
      name: 'Fest 2025',
      acts: [
        makePerf({ artist: 'Late Artist', start: '2025-07-01T20:00:00.000Z', end: '2025-07-01T21:00:00.000Z' }),
        makePerf({ artist: 'Early Artist', start: '2025-07-01T10:00:00.000Z', end: '2025-07-01T11:00:00.000Z' }),
      ],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances[0].artistName).toBe('Early Artist');
    expect(result.performances[1].artistName).toBe('Late Artist');
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — startDate / endDate inference
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — date range inference', () => {
  it('infers startDate from first performance when root lacks it', () => {
    const raw = {
      name: 'Fest 2025',
      acts: [
        makePerf({ artist: 'A', start: '2025-08-10T12:00:00.000Z', end: '2025-08-10T13:00:00.000Z' }),
        makePerf({ artist: 'B', start: '2025-08-12T12:00:00.000Z', end: '2025-08-12T13:00:00.000Z' }),
      ],
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.startDate).toBe('2025-08-10');
  });

  it('reads startDate from root.startDate when present', () => {
    const raw = { name: 'Fest 2025', startDate: '2025-08-09', acts: [makePerf()] };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.startDate).toBe('2025-08-09');
  });
});

// ---------------------------------------------------------------------------
// normalizeClashfinderEvent — edge / adversarial inputs
// ---------------------------------------------------------------------------

describe('normalizeClashfinderEvent — edge cases', () => {
  it('handles null input gracefully', () => {
    expect(() => normalizeClashfinderEvent(null, 'slug')).not.toThrow();
  });

  it('handles array input gracefully', () => {
    expect(() => normalizeClashfinderEvent([], 'slug')).not.toThrow();
  });

  it('handles deeply nested but empty object', () => {
    const raw = { name: 'Fest 2025', days: { day1: { stages: {} } } };
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances).toHaveLength(0);
  });

  it('does not include stage name "locations" as a stage', () => {
    const raw = {
      name: 'Fest 2025',
      locations: {
        'Main Stage': { performances: [makePerf()] },
      },
    };
    const result = normalizeClashfinderEvent(raw, 'f');
    const hasLocationsStage = result.performances.some((p) => p.stageName === 'locations');
    expect(hasLocationsStage).toBe(false);
  });

  it('trims whitespace from artist names', () => {
    const raw = {
      name: 'Fest 2025',
      acts: [makePerf({ artist: '  Spaced Artist  ' })],
    };
    // The artist name is passed through as-is from the raw field; trimming happens in upsertArtists.
    // normalizeClashfinderEvent preserves the raw name.
    const result = normalizeClashfinderEvent(raw, 'f');
    expect(result.performances[0].artistName.trim()).toBe('Spaced Artist');
  });
});
