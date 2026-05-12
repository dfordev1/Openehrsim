import React from 'react';
import { cn } from '../lib/utils';

interface NavTabProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export function NavTab({ active, icon, label, onClick }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px]",
        active
          ? "bg-clinical-blue text-white font-medium"
          : "text-clinical-slate hover:bg-slate-100 hover:text-clinical-ink"
      )}
    >
      <div className={cn("w-4 h-4", active ? "text-white" : "text-clinical-slate/60")}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}
