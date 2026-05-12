import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, ChevronDown, ChevronUp, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ReasoningNudge } from '../types';

interface ReasoningNudgesProps {
  nudges: ReasoningNudge[];
  /** Called when the user clicks a nudge that has a corresponding action
   *  (e.g. "open dx pad", "write illness script"). Optional — if not
   *  provided the nudge is display-only. */
  onAction?: (nudge: ReasoningNudge) => void;
}

/** A slim, dismissible formative-feedback bar. Renders inline under the
 *  workflow stepper and gets out of the way when empty or dismissed. */
export function ReasoningNudges({ nudges, onAction }: ReasoningNudgesProps) {
  // Track which nudges the user has dismissed this session.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => nudges.filter(n => !dismissed.has(n.id)),
    [nudges, dismissed],
  );

  if (visible.length === 0) return null;

  const warnings = visible.filter(n => n.severity === 'warning');
  const infos = visible.filter(n => n.severity === 'info');
  const primary = warnings[0] ?? infos[0];
  const hasMore = visible.length > 1;

  return (
    <div
      className="bg-clinical-surface border-b border-clinical-line/50 shrink-0"
      role="region"
      aria-label="Clinical reasoning hints"
    >
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Brain className="w-3.5 h-3.5 text-teal-600 shrink-0" />

        {/* Primary (highest severity first) nudge summary */}
        <NudgeInline
          nudge={primary}
          onAction={onAction}
          onDismiss={id => setDismissed(prev => new Set(prev).add(id))}
          dense
        />

        {hasMore && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-medium text-clinical-slate/70 hover:text-clinical-ink transition-colors"
            aria-expanded={expanded}
          >
            {visible.length - 1} more
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-clinical-line/40"
          >
            <ul className="px-4 py-2 space-y-1.5">
              {visible.slice(1).map(n => (
                <li key={n.id}>
                  <NudgeInline
                    nudge={n}
                    onAction={onAction}
                    onDismiss={id =>
                      setDismissed(prev => new Set(prev).add(id))
                    }
                  />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A single nudge rendered inline. Extracted so the primary bar and the
 *  expanded list can share styling. */
function NudgeInline({
  nudge,
  onAction,
  onDismiss,
  dense = false,
}: {
  nudge: ReasoningNudge;
  onAction?: (n: ReasoningNudge) => void;
  onDismiss: (id: string) => void;
  dense?: boolean;
}) {
  const warn = nudge.severity === 'warning';
  const Icon = warn ? AlertTriangle : Info;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <Icon
        className={cn(
          'w-3 h-3 shrink-0',
          warn ? 'text-amber-600' : 'text-clinical-slate/70',
        )}
      />
      <button
        type="button"
        onClick={() => onAction?.(nudge)}
        disabled={!onAction}
        className={cn(
          'text-[11px] leading-tight text-left flex-1 min-w-0',
          warn ? 'text-amber-800' : 'text-clinical-slate',
          onAction ? 'hover:underline cursor-pointer' : 'cursor-default',
          dense && 'truncate',
        )}
        title={nudge.message}
      >
        {nudge.message}
      </button>
      <button
        onClick={() => onDismiss(nudge.id)}
        className="p-0.5 text-clinical-slate/40 hover:text-clinical-slate transition-colors shrink-0"
        aria-label="Dismiss hint"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
