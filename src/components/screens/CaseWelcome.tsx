import { motion } from 'motion/react';
import { Play, ArrowRight, Stethoscope, Brain, Target, ListChecks, FileText, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CaseWelcomeProps {
  patientName: string;
  chiefConcern: string;
  difficulty: string;
  category: string;
  onStartWithGuidance: () => void;
  onStartWithoutGuidance: () => void;
  onBack: () => void;
}

const ASSESSMENT_CRITERIA = [
  { icon: Target, text: 'The efficiency and thoroughness of your data acquisition by stage' },
  { icon: ListChecks, text: 'Your ranked differential by stage' },
  { icon: Brain, text: 'Your ability to identify "can\'t miss" diseases' },
  { icon: Stethoscope, text: 'Your lead diagnosis before and after receiving feedback' },
  { icon: FileText, text: 'Your illness script instantiation' },
];

const AI_FEEDBACK_ITEMS = [
  'Your problem representations',
  'Your management plan',
];

export function CaseWelcome({
  patientName, chiefConcern, difficulty, category,
  onStartWithGuidance, onStartWithoutGuidance, onBack,
}: CaseWelcomeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex flex-col">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">Healer</span>
            <span className="text-[8px] text-gray-400 block -mt-0.5 uppercase tracking-wider">by Lecturio</span>
          </div>
        </div>
        <button
          onClick={onBack}
          className="ml-auto text-xs text-gray-500 hover:text-teal-600 font-medium transition-colors"
        >
          Back to Practice
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left column — Assessment info */}
          <div className="space-y-8">
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                Welcome to Healer
              </motion.h1>
              <p className="text-sm text-gray-500">
                You will be assessed on the following during this clinical encounter:
              </p>
            </div>

            {/* Criteria list */}
            <div className="space-y-3">
              {ASSESSMENT_CRITERIA.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.08 }}
                    className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex items-center gap-2 pt-1.5">
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* AI Feedback section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                  You will also receive AI feedback on:
                </span>
              </div>
              <ol className="space-y-1.5 ml-6">
                {AI_FEEDBACK_ITEMS.map((item, idx) => (
                  <li key={idx} className="text-sm text-teal-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>

          {/* Right column — Patient + CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            {/* Patient illustration placeholder */}
            <div className="relative mb-6">
              <div className="w-48 h-64 bg-gradient-to-b from-teal-100 to-teal-50 rounded-3xl border-2 border-teal-200 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Simplified patient silhouette */}
                <div className="w-16 h-16 rounded-full bg-amber-200 border-2 border-amber-300 mb-2" />
                <div className="w-24 h-20 bg-sky-200 rounded-t-2xl border-2 border-sky-300 border-b-0" />
                <div className="w-28 h-16 bg-orange-200 rounded-b-xl border-2 border-orange-300 border-t-0 -mt-1" />
                {/* Pain indicator */}
                <div className="absolute bottom-8 right-6 w-6 h-6 rounded-full bg-red-100 border border-red-300 flex items-center justify-center animate-pulse">
                  <span className="text-[10px] text-red-600 font-bold">!</span>
                </div>
              </div>
              {/* Exam chair indicator */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-36 h-3 bg-teal-200 rounded-full opacity-60" />
            </div>

            {/* Patient info */}
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide mb-1">
              {patientName}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              Chief concern: <span className="font-medium text-gray-700">{chiefConcern}</span>
            </p>
            <div className="flex items-center gap-2 mb-8">
              <span className={cn(
                'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                difficulty === 'intern' ? 'bg-green-50 text-green-700 border border-green-200' :
                difficulty === 'resident' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              )}>
                {difficulty}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">{category}</span>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3 w-full max-w-xs">
              <button
                onClick={onStartWithGuidance}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-teal-200 transition-all hover:shadow-xl hover:shadow-teal-200 hover:-translate-y-0.5"
              >
                <span className="text-lg">👩‍⚕️</span>
                Start Case with Guidance
              </button>
              <button
                onClick={onStartWithoutGuidance}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 hover:border-teal-300 text-gray-700 hover:text-teal-700 rounded-xl font-medium text-sm transition-all"
              >
                Start Case without Guidance
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
