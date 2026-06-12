export function timeLabel(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function festivalTitle(name: string, year: number): string {
  return name.includes(String(year)) ? name : `${name} ${year}`;
}

export function isFestivalActive(festival: {
  start_date: string | null;
  end_date: string | null;
}): boolean {
  if (!festival.start_date || !festival.end_date) return false;
  const now = Date.now();
  return (
    new Date(festival.start_date).getTime() <= now &&
    new Date(festival.end_date + 'T23:59:59').getTime() >= now
  );
}

export function formatMinutesUntil(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return 'Starting now!';
  if (minutes === 1) return 'In 1 min';
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `In ${hours}h` : `In ${hours}h ${rem}m`;
}

export function absHour(dateString: string, refTime: number): number {
  return (new Date(dateString).getTime() - refTime) / 36e5;
}

export function durationHours(start: string, end: string): number {
  return Math.max(0.5, (new Date(end).getTime() - new Date(start).getTime()) / 36e5);
}

export function assignLanes(items: { id: number; startTime: string; endTime: string }[]): Map<number, number> {
  const sorted = [...items].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const laneEnds: number[] = [];
  const result = new Map<number, number>();
  for (const item of sorted) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    result.set(item.id, lane);
  }
  return result;
}
