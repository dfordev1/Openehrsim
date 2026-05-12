import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Home, ClipboardList, BarChart3, Stethoscope, BookOpen,
  Play, HelpCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardProps {
  onStartPractice: () => void;
  onNavigate: (view: 'dashboard' | 'practice' | 'assignments' | 'performance') => void;
  activeView: string;
  completedCases: number;
  assignedCases: number;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'performance', label: 'Assignment Performance', icon: BarChart3 },
  { id: 'practice', label: 'Practice', icon: Stethoscope, expandable: true },
  { id: 'practice-performance', label: 'Practice Performance', icon: BarChart3 },
  { id: 'knowledge', label: 'Knowledge Center', icon: BookOpen },
];

export function Dashboard({ onStartPractice, onNavigate, activeView, completedCases, assignedCases }: DashboardProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const totalCases = completedCases + assignedCases;
  const progressPercent = totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0;

  return (
    <div className="h-screen flex bg-white">
      {/* Sidebar */}
      <aside className={cn(
        'bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <span className="text-sm font-bold text-gray-900">Healer</span>
                <span className="text-[8px] text-gray-400 block -mt-0.5 uppercase tracking-wider">by Lecturio</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as any)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive ? 'text-teal-600' : 'text-gray-400')} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.expandable && <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onStartPractice}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              Practice Case
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <HelpCircle className="w-4 h-4" />
              Help
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Assignments Section */}
            <div className="lg:col-span-2 space-y-4">
              {/* Overdue */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                    Overdue Assignments
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center">0</span>
                  </h2>
                </div>
                <div className="text-center py-8">
                  <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">You have no assignments.</p>
                  <p className="text-sm text-gray-500">You can start a Practice Case.</p>
                  <button
                    onClick={onStartPractice}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Practice Case
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Recent Activity</h2>
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 italic">No recent case activity.</p>
                </div>
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-4">
              {/* Progress Donut */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Progress</h2>
                
                {/* Donut Chart */}
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      {/* Background circle */}
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                      {/* Progress circle */}
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke="#0d9488"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${progressPercent * 3.14} 314`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{progressPercent}%</span>
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{completedCases}</span> Completed
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{assignedCases}</span> Assigned
                    </p>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center bg-gray-100 rounded-lg p-1 mt-4">
                    <button className="px-3 py-1.5 text-[10px] font-semibold bg-white text-gray-700 rounded-md shadow-sm">
                      Assigned
                    </button>
                    <button className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 rounded-md">
                      Practice
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  <button
                    onClick={onStartPractice}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg text-sm font-medium text-teal-700 transition-colors"
                  >
                    <Play className="w-4 h-4 text-teal-600 fill-teal-600" />
                    Start Practice Case
                  </button>
                  <button
                    onClick={() => onNavigate('practice')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    <Stethoscope className="w-4 h-4 text-gray-500" />
                    Browse Cases
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
