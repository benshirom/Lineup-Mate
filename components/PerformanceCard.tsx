import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export type PreferenceStatus = 'going' | 'maybe' | 'not_interested';

interface PerformanceCardProps {
  performanceId: number;
  artistName: string;
  stageName: string;
  startTime: string;
  endTime: string;
  initialStatus?: PreferenceStatus | null;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  performanceId,
  artistName,
  stageName,
  startTime,
  endTime,
  initialStatus
}) => {
  const { user, supabase } = useAuth();
  const [status, setStatus] = useState<PreferenceStatus | null>(initialStatus ?? null);
  const [saving, setSaving] = useState(false);

  const handleSetStatus = async (newStatus: PreferenceStatus | null) => {
    if (!user) return;
    setSaving(true);
    // Upsert the preference in user_performance_preferences
    try {
      const { error } = await supabase.rpc('upsert_user_preference', {
        p_user_id: user.id,
        p_performance_id: performanceId,
        p_status: newStatus
      });
      if (error) throw error;
      setStatus(newStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isActive = (button: PreferenceStatus | null) => status === button;

  return (
    <div className="border rounded-md p-3 mb-2 bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-semibold">{artistName}</div>
          <div className="text-xs text-gray-600">
            {startTime} – {endTime}
          </div>
          <div className="text-xs text-gray-500">{stageName}</div>
        </div>
        <div className="flex gap-1">
          {(
            [
              { label: 'Going', value: 'going' as PreferenceStatus, color: 'bg-green-500' },
              { label: 'Maybe', value: 'maybe' as PreferenceStatus, color: 'bg-yellow-500' },
              { label: 'Skip', value: 'not_interested' as PreferenceStatus, color: 'bg-red-500' },
              { label: 'Clear', value: null, color: 'bg-gray-400' }
            ]
          ).map((btn) => (
            <button
              key={btn.label}
              disabled={saving}
              onClick={() => handleSetStatus(btn.value as any)}
              className={
                'text-xs px-2 py-1 rounded text-white transition ' +
                (isActive(btn.value as any)
                  ? btn.color
                  : btn.color.replace('bg-', 'bg-opacity-30 text-') + btn.color.slice(3))
              }
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceCard;