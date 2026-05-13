import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface NavTabProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}

export function NavTab({ active, icon, label, onClick, badge }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition-all text-[11px]",
        active
          ? "bg-clinical-blue/10 text-clinical-blue font-medium"
          : "text-clinical-slate hover:bg-clinical-bg hover:text-clinical-ink"
      )}
    >
      <div className={cn("w-3.5 h-3.5 shrink-0", active ? "text-clinical-blue" : "text-clinical-slate/50")}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto text-[9px] font-medium bg-clinical-blue/10 text-clinical-blue px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
