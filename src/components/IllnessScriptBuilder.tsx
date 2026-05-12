import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, GripVertical, Table, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ClinicalFinding } from '../types';

interface IllnessScriptBuilderProps {
  findings: ClinicalFinding[];
  topDiseases: string[]; // Top 3 diseases from the case
  onComplete: (placements: Record<string, string[]>) => void;
}

type VennRegion = 'A' | 'B' | 'C' | 'AB' | 'AC' | 'BC' | 'ABC' | 'none';

interface PlacedFinding {
  finding: ClinicalFinding;
  region: VennRegion;
  likelihood: 'more' | 'less';
}

// Color key for likelihood
const LIKELIHOOD_COLORS = {
  more: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
  less: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
};

export function IllnessScriptBuilder({ findings, topDiseases, onComplete }: IllnessScriptBuilderProps) {
  const [placements, setPlacements] = useState<PlacedFinding[]>([]);
  const [viewMode, setViewMode] = useState<'venn' | 'table'>('venn');
  const [draggedFinding, setDraggedFinding] = useState<ClinicalFinding | null>(null);

  // Findings not yet placed
  const unplacedFindings = findings.filter(
    f => !placements.some(p => p.finding.id === f.id)
  );

  const [diseaseA, diseaseB, diseaseC] = topDiseases.length >= 3
    ? topDiseases.slice(0, 3)
    : [...topDiseases, 'Disease A', 'Disease B', 'Disease C'].slice(0, 3);

  const handleDrop = useCallback((region: VennRegion, findingId: string) => {
    const finding = findings.find(f => f.id === findingId);
    if (!finding) return;

    setPlacements(prev => {
      const existing = prev.find(p => p.finding.id === findingId);
      if (existing) {
        return prev.map(p => p.finding.id === findingId ? { ...p, region } : p);
      }
      return [...prev, { finding, region, likelihood: 'more' }];
    });
    setDraggedFinding(null);
  }, [findings]);

  const removePlacement = useCallback((findingId: string) => {
    setPlacements(prev => prev.filter(p => p.finding.id !== findingId));
  }, []);

  const toggleLikelihood = useCallback((findingId: string) => {
    setPlacements(prev => prev.map(p =>
      p.finding.id === findingId
        ? { ...p, likelihood: p.likelihood === 'more' ? 'less' : 'more' }
        : p
    ));
  }, []);

  const clearAll = useCallback(() => {
    setPlacements([]);
  }, []);

  const allPlaced = unplacedFindings.length === 0 && findings.length > 0;

  const getRegionFindings = (region: VennRegion) =>
    placements.filter(p => p.region === region);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-clinical-ink">Illness Script Builder</h3>
          <span className="text-[10px] text-clinical-slate font-mono">
            {placements.length}/{findings.length} placed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'venn' ? 'table' : 'venn')}
            className="flex items-center gap-1.5 text-[10px] font-medium text-clinical-blue bg-clinical-blue/10 hover:bg-clinical-blue/20 px-2.5 py-1 rounded-md transition-colors"
          >
            <Table className="w-3 h-3" />
            {viewMode === 'venn' ? 'Table View' : 'Venn View'}
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-[10px] font-medium text-clinical-red bg-clinical-red/10 hover:bg-clinical-red/20 px-2.5 py-1 rounded-md transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        </div>
      </div>

      {/* Color Key */}
      <div className="flex items-center gap-4 p-2.5 bg-clinical-bg/50 border border-clinical-line rounded-lg">
        <span className="text-[9px] font-bold text-clinical-slate uppercase">KEY:</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-green-700 font-medium">More Likely</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span className="text-orange-700 font-medium">Less Likely</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Findings list (unplaced) */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Findings ({unplacedFindings.length})</span>
          </div>
          <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
            {unplacedFindings.length === 0 ? (
              <p className="text-xs text-clinical-slate/50 italic text-center py-4">
                {findings.length === 0 ? 'No findings tracked yet.' : 'All findings placed!'}
              </p>
            ) : (
              unplacedFindings.map((finding, idx) => (
                <div
                  key={finding.id}
                  draggable
                  onDragStart={() => setDraggedFinding(finding)}
                  onDragEnd={() => setDraggedFinding(null)}
                  className="flex items-center gap-2 px-2.5 py-2 bg-clinical-bg/50 border border-clinical-line rounded-md cursor-grab hover:border-teal-300 hover:bg-teal-50/30 transition-all text-xs"
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                    finding.relevance === 'positive' ? 'bg-green-500' :
                    finding.relevance === 'negative' ? 'bg-orange-500' :
                    'bg-clinical-slate/40'
                  )}>
                    {idx + 1}
                  </div>
                  <span className="flex-1 truncate text-clinical-ink">{finding.text}</span>
                  <GripVertical className="w-3 h-3 text-clinical-slate/30 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Venn Diagram / Table */}
        <div className="lg:col-span-2">
          {viewMode === 'venn' ? (
            <div className="panel min-h-[350px] relative">
              <div className="panel-header">
                <span className="panel-title">Drop findings into disease regions</span>
              </div>
              <div className="p-4 relative h-[320px]">
                {/* Three overlapping circles */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
                  {/* Circle A - top */}
                  <circle cx="200" cy="110" r="90" fill="rgba(20,184,166,0.08)" stroke="rgba(20,184,166,0.3)" strokeWidth="2" />
                  {/* Circle B - bottom-left */}
                  <circle cx="150" cy="200" r="90" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.3)" strokeWidth="2" />
                  {/* Circle C - bottom-right */}
                  <circle cx="250" cy="200" r="90" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.3)" strokeWidth="2" />
                </svg>

                {/* Disease labels */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-teal-700 bg-white/80 px-2 py-0.5 rounded">
                  {diseaseA}
                </div>
                <div className="absolute bottom-2 left-8 text-[10px] font-bold text-blue-700 bg-white/80 px-2 py-0.5 rounded">
                  {diseaseB}
                </div>
                <div className="absolute bottom-2 right-8 text-[10px] font-bold text-purple-700 bg-white/80 px-2 py-0.5 rounded">
                  {diseaseC}
                </div>

                {/* Drop zones - simplified clickable regions */}
                {(['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'] as VennRegion[]).map(region => {
                  const regionFindings = getRegionFindings(region);
                  const positions: Record<VennRegion, string> = {
                    A: 'top-[15%] left-[42%]',
                    B: 'top-[60%] left-[20%]',
                    C: 'top-[60%] right-[20%]',
                    AB: 'top-[40%] left-[30%]',
                    AC: 'top-[40%] right-[30%]',
                    BC: 'top-[65%] left-[42%]',
                    ABC: 'top-[45%] left-[42%]',
                    none: '',
                  };

                  return (
                    <div
                      key={region}
                      className={cn(
                        'absolute w-16 h-16 rounded-full flex flex-col items-center justify-center',
                        'border-2 border-dashed transition-all cursor-pointer',
                        draggedFinding ? 'border-teal-400 bg-teal-50/50 scale-110' : 'border-transparent',
                        positions[region]
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedFinding) handleDrop(region, draggedFinding.id);
                      }}
                      onClick={() => {
                        if (draggedFinding) handleDrop(region, draggedFinding.id);
                      }}
                    >
                      {regionFindings.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {regionFindings.slice(0, 3).map(pf => (
                            <div
                              key={pf.finding.id}
                              className={cn(
                                'w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center cursor-pointer',
                                pf.likelihood === 'more' ? 'bg-green-500' : 'bg-orange-500'
                              )}
                              onClick={(e) => { e.stopPropagation(); toggleLikelihood(pf.finding.id); }}
                              title={`${pf.finding.text} (click to toggle)`}
                            />
                          ))}
                          {regionFindings.length > 3 && (
                            <span className="text-[8px] text-clinical-slate">+{regionFindings.length - 3}</span>
                          )}
                        </div>
                      )}
                      <span className="text-[8px] text-clinical-slate/50 mt-0.5">{region}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Table view */
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Illness Script Table</span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-clinical-bg/50">
                      <th className="p-2 text-left text-[10px] font-semibold text-clinical-slate">Finding</th>
                      <th className="p-2 text-center text-[10px] font-semibold text-teal-700">{diseaseA}</th>
                      <th className="p-2 text-center text-[10px] font-semibold text-blue-700">{diseaseB}</th>
                      <th className="p-2 text-center text-[10px] font-semibold text-purple-700">{diseaseC}</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map(pf => (
                      <tr key={pf.finding.id} className="border-t border-clinical-line/50">
                        <td className="p-2 text-clinical-ink">{pf.finding.text}</td>
                        <td className="p-2 text-center">
                          {(pf.region === 'A' || pf.region === 'AB' || pf.region === 'AC' || pf.region === 'ABC') && (
                            <div className={cn('w-3 h-3 rounded-full mx-auto', pf.likelihood === 'more' ? 'bg-green-500' : 'bg-orange-500')} />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {(pf.region === 'B' || pf.region === 'AB' || pf.region === 'BC' || pf.region === 'ABC') && (
                            <div className={cn('w-3 h-3 rounded-full mx-auto', pf.likelihood === 'more' ? 'bg-green-500' : 'bg-orange-500')} />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {(pf.region === 'C' || pf.region === 'AC' || pf.region === 'BC' || pf.region === 'ABC') && (
                            <div className={cn('w-3 h-3 rounded-full mx-auto', pf.likelihood === 'more' ? 'bg-green-500' : 'bg-orange-500')} />
                          )}
                        </td>
                        <td className="p-2">
                          <button onClick={() => removePlacement(pf.finding.id)} className="text-clinical-slate/30 hover:text-clinical-red">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {placements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-clinical-slate/50 italic">
                          Drag findings from the left panel to place them
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between p-3 bg-clinical-bg/50 border border-clinical-line rounded-lg">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 bg-clinical-line rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: findings.length > 0 ? `${(placements.length / findings.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-clinical-slate">
            {placements.length}/{findings.length} findings placed
          </span>
        </div>
        {allPlaced && (
          <button
            onClick={() => {
              const result: Record<string, string[]> = {};
              placements.forEach(p => {
                if (!result[p.region]) result[p.region] = [];
                result[p.region].push(p.finding.text);
              });
              onComplete(result);
            }}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-medium transition-colors"
          >
            Complete Illness Script
          </button>
        )}
      </div>
    </div>
  );
}
