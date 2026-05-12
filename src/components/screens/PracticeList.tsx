import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, MoreVertical, Play, RotateCcw, Eye, ChevronDown, X, Filter,
  Stethoscope, ArrowUpDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PracticeCase {
  id: string;
  name: string;
  chiefConcern: string;
  inProgress: boolean;
  completedCount: number;
  difficulty: 'intern' | 'resident' | 'attending';
  category: string;
  acuity: 'low' | 'moderate' | 'high';
}

interface PracticeListProps {
  onStartCase: (caseId: string, difficulty?: string, category?: string) => void;
  onBack: () => void;
}

const SAMPLE_CASES: PracticeCase[] = [
  { id: 'case-aliyah', name: 'Aliyah Jones', chiefConcern: 'Abdominal Pain', inProgress: false, completedCount: 0, difficulty: 'resident', category: 'Gastrointestinal', acuity: 'moderate' },
  { id: 'case-mariana', name: 'SHORT DEMO: Mariana Perez', chiefConcern: 'Cough', inProgress: false, completedCount: 0, difficulty: 'intern', category: 'Pulmonology', acuity: 'low' },
  { id: 'case-james', name: 'James Thompson', chiefConcern: 'Chest Pain', inProgress: false, completedCount: 0, difficulty: 'attending', category: 'Cardiology', acuity: 'high' },
  { id: 'case-sarah', name: 'Sarah Mitchell', chiefConcern: 'Headache', inProgress: false, completedCount: 0, difficulty: 'resident', category: 'Neurology', acuity: 'moderate' },
  { id: 'case-david', name: 'David Chen', chiefConcern: 'Fever and Rash', inProgress: false, completedCount: 0, difficulty: 'resident', category: 'Infectious Disease', acuity: 'moderate' },
  { id: 'case-emma', name: 'Emma Rodriguez', chiefConcern: 'Shortness of Breath', inProgress: false, completedCount: 0, difficulty: 'attending', category: 'Pulmonology', acuity: 'high' },
];

const FILTER_SECTIONS = [
  { label: 'Acuity', options: ['Low', 'Moderate', 'High'] },
  { label: 'Difficulty', options: ['Intern', 'Resident', 'Attending'] },
  { label: 'Organ System', options: ['Cardiology', 'Pulmonology', 'Gastrointestinal', 'Neurology', 'Infectious Disease', 'Trauma'] },
];

export function PracticeList({ onStartCase, onBack }: PracticeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedFilters, setExpandedFilters] = useState<string[]>(['Difficulty']);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState<'name' | 'concern'>('name');

  // Filter cases
  const filteredCases = SAMPLE_CASES.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.chiefConcern.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Apply active filters
    if (activeFilters['Difficulty']?.length && !activeFilters['Difficulty'].includes(c.difficulty.charAt(0).toUpperCase() + c.difficulty.slice(1))) {
      return false;
    }
    if (activeFilters['Organ System']?.length && !activeFilters['Organ System'].includes(c.category)) {
      return false;
    }
    if (activeFilters['Acuity']?.length && !activeFilters['Acuity'].includes(c.acuity.charAt(0).toUpperCase() + c.acuity.slice(1))) {
      return false;
    }
    return true;
  });

  const toggleFilter = (section: string, option: string) => {
    setActiveFilters(prev => {
      const current = prev[section] || [];
      const next = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      return { ...prev, [section]: next };
    });
  };

  const clearFilters = (section: string) => {
    setActiveFilters(prev => ({ ...prev, [section]: [] }));
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Filters Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Practice</h2>
          <button onClick={onBack} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
            Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
          {FILTER_SECTIONS.map(section => {
            const isExpanded = expandedFilters.includes(section.label);
            const activeCount = (activeFilters[section.label] || []).length;

            return (
              <div key={section.label} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFilters(prev =>
                    prev.includes(section.label) ? prev.filter(s => s !== section.label) : [...prev, section.label]
                  )}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    {section.label}
                    {activeCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center font-bold">
                        {activeCount}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                </button>

                {isExpanded && (
                  <div className="px-3 py-2 space-y-1 border-t border-gray-100">
                    {activeCount > 0 && (
                      <button
                        onClick={() => clearFilters(section.label)}
                        className="text-[10px] text-red-500 hover:text-red-600 font-medium mb-1"
                      >
                        CLEAR
                      </button>
                    )}
                    {section.options.map(option => {
                      const isActive = (activeFilters[section.label] || []).includes(option);
                      return (
                        <label key={option} className="flex items-center gap-2 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggleFilter(section.label, option)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className={cn('text-xs', isActive ? 'text-teal-700 font-medium' : 'text-gray-600')}>
                            {option}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-base font-semibold text-gray-900 uppercase tracking-wide">Practice</h1>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </div>
        </header>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
              <tr>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('name')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Case
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => setSortBy('concern')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Chief Concern
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">In Progress</th>
                <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Complete</th>
                <th className="w-12 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCases.map(caseItem => (
                <tr
                  key={caseItem.id}
                  className="hover:bg-teal-50/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{caseItem.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            caseItem.difficulty === 'intern' ? 'bg-green-50 text-green-700' :
                            caseItem.difficulty === 'resident' ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          )}>
                            {caseItem.difficulty}
                          </span>
                          <span className="text-[10px] text-gray-400">{caseItem.category}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700">{caseItem.chiefConcern}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      'text-xs font-medium',
                      caseItem.inProgress ? 'text-amber-600' : 'text-gray-400'
                    )}>
                      {caseItem.inProgress ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-medium text-gray-500">{caseItem.completedCount}</span>
                  </td>
                  <td className="px-3 py-4 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === caseItem.id ? null : caseItem.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>

                    {/* Kebab Menu */}
                    <AnimatePresence>
                      {openMenuId === caseItem.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[160px] overflow-hidden"
                          >
                            <button
                              onClick={() => { onStartCase(caseItem.id, caseItem.difficulty, caseItem.category); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Start
                            </button>
                            <button
                              disabled
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Resume
                            </button>
                            <button
                              disabled
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Start Over
                            </button>
                            <button
                              disabled
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed border-t border-gray-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Performance
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCases.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No cases match your filters.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
