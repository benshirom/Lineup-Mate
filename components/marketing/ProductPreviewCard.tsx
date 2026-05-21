import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors, typography } from '@/lib/platform';

const nightPreview = [
  { time: '22:30', label: 'Main floor', title: 'Crew pick', state: 'Saved' },
  { time: '00:10', label: 'Forest stage', title: 'Schedule clash', state: 'Conflict' },
  { time: '01:45', label: 'Dome', title: 'Next move', state: 'Meet' },
];

export default function ProductPreviewCard() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  return (
    <div data-testid="product-preview-card" className="fade-up overflow-hidden rounded-[30px] p-5 shadow-2xl" style={{ background: `linear-gradient(180deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: c.muted }}>Your night</p>
          <h2 className="mt-1 text-2xl font-black" style={{ fontFamily: typography.display }}>Crew radar</h2>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: `${c.success}1f`, color: c.success, border: `1px solid ${c.success}44` }}>Live plan</span>
      </div>
      <div className="space-y-3">
        {nightPreview.map((item, index) => (
          <div key={item.time} className="relative overflow-hidden rounded-2xl p-4" style={{ background: c.surf, border: `1px solid ${index === 1 ? `${c.warning}55` : c.brd}` }}>
            <div className="absolute left-0 top-0 h-full w-1" style={{ background: index === 1 ? c.warning : index === 2 ? c.accB : c.acc }} />
            <div className="flex items-center justify-between gap-3 pl-2">
              <div>
                <div className="text-xs font-black" style={{ color: c.muted }}>{item.time} · {item.label}</div>
                <div className="mt-1 text-base font-black">{item.title}</div>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: index === 1 ? `${c.warning}1f` : `${c.acc}18`, color: index === 1 ? c.warning : c.acc }}>
                {item.state}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed" style={{ color: c.muted }}>
        Clashfinder shows the schedule. Lineup·Mate helps you decide where to go next.
      </p>
    </div>
  );
}
