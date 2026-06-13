import { describe, it, expect } from 'vitest';
import { assignLanes, durationHours, absHour } from '../festivalUtils';

function perf(id: number, startIso: string, endIso: string) {
  return { id, startTime: startIso, endTime: endIso };
}

describe('assignLanes', () => {
  it('assigns a single item to lane 0', () => {
    const items = [perf(1, '2025-07-01T14:00:00Z', '2025-07-01T15:00:00Z')];
    const lanes = assignLanes(items);
    expect(lanes.get(1)).toBe(0);
  });

  it('assigns non-overlapping items to the same lane', () => {
    const items = [
      perf(1, '2025-07-01T14:00:00Z', '2025-07-01T15:00:00Z'),
      perf(2, '2025-07-01T15:00:00Z', '2025-07-01T16:00:00Z'),
    ];
    const lanes = assignLanes(items);
    expect(lanes.get(1)).toBe(0);
    expect(lanes.get(2)).toBe(0);
  });

  it('assigns overlapping items to different lanes', () => {
    const items = [
      perf(1, '2025-07-01T14:00:00Z', '2025-07-01T16:00:00Z'),
      perf(2, '2025-07-01T15:00:00Z', '2025-07-01T17:00:00Z'),
    ];
    const lanes = assignLanes(items);
    expect(lanes.get(1)).toBe(0);
    expect(lanes.get(2)).toBe(1);
  });

  it('reuses a lane when an earlier overlap ends', () => {
    const items = [
      perf(1, '2025-07-01T14:00:00Z', '2025-07-01T15:00:00Z'),
      perf(2, '2025-07-01T14:00:00Z', '2025-07-01T15:00:00Z'),
      perf(3, '2025-07-01T15:00:00Z', '2025-07-01T16:00:00Z'),
    ];
    const lanes = assignLanes(items);
    // item 3 starts exactly when items 1 and 2 end — should reuse lane 0 or 1
    expect(lanes.get(3)).toBeLessThan(2);
  });

  it('handles three simultaneous items in three separate lanes', () => {
    const items = [
      perf(1, '2025-07-01T14:00:00Z', '2025-07-01T16:00:00Z'),
      perf(2, '2025-07-01T14:00:00Z', '2025-07-01T16:00:00Z'),
      perf(3, '2025-07-01T14:00:00Z', '2025-07-01T16:00:00Z'),
    ];
    const lanes = assignLanes(items);
    const values = [lanes.get(1)!, lanes.get(2)!, lanes.get(3)!].sort();
    expect(values).toEqual([0, 1, 2]);
  });
});

describe('durationHours', () => {
  it('returns correct duration', () => {
    expect(durationHours('2025-07-01T14:00:00Z', '2025-07-01T16:00:00Z')).toBe(2);
  });

  it('clamps to minimum 0.5 for very short durations', () => {
    expect(durationHours('2025-07-01T14:00:00Z', '2025-07-01T14:10:00Z')).toBe(0.5);
  });
});

describe('absHour', () => {
  it('returns 0 when time equals refTime', () => {
    const ref = new Date('2025-07-01T00:00:00Z').getTime();
    expect(absHour('2025-07-01T00:00:00Z', ref)).toBe(0);
  });

  it('returns correct hours offset', () => {
    const ref = new Date('2025-07-01T00:00:00Z').getTime();
    expect(absHour('2025-07-01T02:30:00Z', ref)).toBe(2.5);
  });
});
