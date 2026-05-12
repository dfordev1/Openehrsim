import React from 'react';
import { ChevronRight } from 'lucide-react';
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
        "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm font-medium group",
        active
          ? "bg-clinical-blue text-white shadow-md shadow-clinical-blue/20 translate-x-1"
          : "text-clinical-slate hover:bg-clinical-bg"
      )}
    >
      <div className={cn("transition-colors", active ? "text-white" : "text-clinical-slate opacity-40")}>
        {icon}
      </div>
      <span className="tracking-tight">{label}</span>
      {active && <ChevronRight className="ml-auto w-3 h-3 text-white opacity-50" />}
    </button>
  );
}
