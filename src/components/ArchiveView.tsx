import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, History } from 'lucide-react';
import { getRecentSimulations } from '../services/storageService';
import type { User } from '../lib/supabase';
import { cn } from '../lib/utils';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

interface ArchiveViewProps {
  user: User | null;
}

export function ArchiveView({ user }: ArchiveViewProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getRecentSimulations()
        .then(setRecords)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <EmptyState
        icon={<ShieldAlert className="w-10 h-10" />}
        title="Authentication Required"
        description="Clinical archives are encrypted. Please sign in to view your simulation history."
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-10 h-10" />}
        title="Archive Empty"
        description="Complete simulations to preserve clinical history."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="clinical-table w-full" aria-label="Simulation archive records">
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">Patient</th>
            <th scope="col">Difficulty</th>
            <th scope="col">Category</th>
            <th scope="col">Outcome</th>
            <th scope="col">Diagnosis</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="hover:bg-clinical-bg/50 transition-colors">
              <td className="text-xs font-mono whitespace-nowrap text-clinical-slate">
                {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="font-medium text-clinical-ink">{r.patient_name} <span className="text-clinical-slate font-normal">({r.age}y)</span></td>
              <td>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  r.difficulty === 'attending' ? "bg-clinical-red/8 text-clinical-red" :
                  r.difficulty === 'resident' ? "bg-clinical-amber/8 text-clinical-amber" : "bg-clinical-green/8 text-clinical-green"
                )}>{r.difficulty}</span>
              </td>
              <td className="text-xs text-clinical-slate capitalize">{r.category}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-semibold",
                    r.score >= 80 ? "text-clinical-green" : "text-clinical-amber"
                  )}>{r.score}%</span>
                  <div className="w-12 h-1.5 bg-clinical-bg rounded-full overflow-hidden" aria-hidden="true">
                    <div className={cn("h-full rounded-full", r.score >= 80 ? "bg-clinical-green" : "bg-clinical-amber")} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              </td>
              <td className="text-xs text-clinical-slate italic max-w-[200px] truncate">{r.correct_diagnosis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
