import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, History } from 'lucide-react';
import { getRecentSimulations } from '../services/storageService';
import type { User } from '../lib/supabase';
import { cn } from '../lib/utils';

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
      <div className="p-12 text-center text-clinical-slate flex flex-col items-center">
        <ShieldAlert className="w-10 h-10 mb-4 opacity-20" aria-hidden="true" />
        <p className="text-xs uppercase font-black tracking-widest text-clinical-ink">Authentication Required</p>
        <p className="text-[10px] mt-2 mb-6 max-w-[240px]">Clinical archives are encrypted and restricted to authorized personnel. Please sign in to view your simulation history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-clinical-slate" role="status" aria-label="Loading records">
        <Loader2 className="w-6 h-6 animate-spin text-clinical-blue" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-clinical-ink">Retrieving clinical records...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-12 text-center text-clinical-slate opacity-40">
        <History className="w-10 h-10 mx-auto mb-4 opacity-10" aria-hidden="true" />
        <p className="text-xs uppercase font-bold tracking-widest">Archive Empty</p>
        <p className="text-[10px] mt-2">Complete simulations to preserve clinical history.</p>
      </div>
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
            <th scope="col">DX (Correct)</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="hover:bg-clinical-bg/30">
              <td className="text-[10px] font-mono whitespace-nowrap">
                {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="font-bold text-clinical-ink">{r.patient_name} <span className="font-normal opacity-50">({r.age}y)</span></td>
              <td>
                <span className={cn(
                  "text-[9px] font-black px-1.5 py-0.5 rounded uppercase",
                  r.difficulty === 'attending' ? "bg-clinical-red/10 text-clinical-red" :
                  r.difficulty === 'resident' ? "bg-clinical-amber/10 text-clinical-amber" : "bg-clinical-green/10 text-clinical-green"
                )}>{r.difficulty}</span>
              </td>
              <td className="text-[10px] uppercase font-bold text-clinical-slate">{r.category}</td>
              <td>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-black",
                    r.score >= 80 ? "text-clinical-green" : "text-clinical-amber"
                  )}>{r.score}%</span>
                  <div className="w-16 h-1.5 bg-clinical-bg rounded-full overflow-hidden" aria-hidden="true">
                    <div className={cn("h-full", r.score >= 80 ? "bg-clinical-green" : "bg-clinical-amber")} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              </td>
              <td className="text-[10px] font-medium text-clinical-slate italic">"{r.correct_diagnosis}"</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
