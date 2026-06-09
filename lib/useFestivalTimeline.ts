import { useEffect, useState } from 'react';

export function useNowLine(hours: number[], minHour: number, hourWidth: number, refTime: number) {
  const [nowLeft, setNowLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (!refTime) { setNowLeft(null); return; }
      const nowAbsHour = (Date.now() - refTime) / 36e5;
      if (hours.length === 0 || nowAbsHour < hours[0] || nowAbsHour > hours[hours.length - 1] + 1) { setNowLeft(null); return; }
      setNowLeft((nowAbsHour - minHour) * hourWidth);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [hours, minHour, hourWidth, refTime]);

  return nowLeft;
}

export function useHourWidth() {
  const [w, setW] = useState(118);
  useEffect(() => {
    const update = () => setW(window.innerWidth < 640 ? 72 : 118);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}

export function useStageLabelWidth() {
  const [w, setW] = useState(132);
  useEffect(() => {
    const update = () => setW(window.innerWidth < 640 ? 80 : 132);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}
