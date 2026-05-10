import React, { useState } from 'react';
import { useRouter } from 'next/router';
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

const preferenceButtons: Array<{
  label: string;
  value: PreferenceStatus | null;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    label: 'Going',
    value: 'going',
    activeClass: 'bg-green-600 text-white border-green-600',
    inactiveClass: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
  },
  {
    label: 'Maybe',
    value: 'maybe',
    activeClass: 'bg-yellow-500 text-white border-yellow-500',
    inactiveClass: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
  },
  {
    label: 'Skip',
    value: 'not_interested',
    activeClass: 'bg-red-600 text-white border-red-600',
    inactiveClass: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
  },
  {
    label: 'Clear',
    value: null,
    activeClass: 'bg-gray-700 text-white border-gray-700',
    inactiveClass: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
  }
];

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  performanceId,
  artistName,
  stageName,
  startTime,
  endTime,
  initialStatus
}) => {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [status, setStatus] = useState<PreferenceStatus | null>(initialStatus ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetStatus = async (newStatus: PreferenceStatus | null) => {
    if (!user) {
      router.push('/login');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('upsert_user_preference', {
        p_user_id: user.id,
        p_performance_id: performanceId,
        p_status: newStatus
      });

      if (error) throw error;
      setStatus(newStatus);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save your preference.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-3 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <div className="font-semibold text-gray-900">{artistName}</div>
          <div className="text-sm text-gray-600">
            {startTime} – {endTime}
          </div>
          <div className="text-xs text-gray-500">{stageName}</div>
        </div>

        <div>
          {!user && <p className="mb-2 text-xs text-gray-500">Sign in to save this act to your lineup.</p>}
          <div className="flex flex-wrap gap-2">
            {preferenceButtons.map((btn) => {
              const active = status === btn.value;
              return (
                <button
                  key={btn.label}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSetStatus(btn.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    active ? btn.activeClass : btn.inactiveClass
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default PerformanceCard;
