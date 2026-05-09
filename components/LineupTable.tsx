import React from 'react';
import PerformanceCard, { PreferenceStatus } from './PerformanceCard';

export interface LineupPerformance {
  id: number;
  artist_name: string;
  stage_name: string;
  start_time: string;
  end_time: string;
  status?: PreferenceStatus | null;
}

interface LineupTableProps {
  performances: LineupPerformance[];
}

const LineupTable: React.FC<LineupTableProps> = ({ performances }) => {
  return (
    <div>
      {performances.map((perf) => (
        <PerformanceCard
          key={perf.id}
          performanceId={perf.id}
          artistName={perf.artist_name}
          stageName={perf.stage_name}
          startTime={new Date(perf.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          endTime={new Date(perf.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          initialStatus={perf.status}
        />
      ))}
    </div>
  );
};

export default LineupTable;