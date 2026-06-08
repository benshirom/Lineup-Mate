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
