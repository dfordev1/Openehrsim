import { useState, useCallback } from 'react';

/**
 * Application views/routes for the pre-case flow.
 * 
 * Flow: dashboard → practice → welcome → case (active simulation)
 */
export type AppView = 'dashboard' | 'practice' | 'welcome' | 'case';

interface CaseContext {
  caseId: string | null;
  difficulty: string;
  category: string;
  patientName: string;
  chiefConcern: string;
  withGuidance: boolean;
}

const DEFAULT_CASE_CONTEXT: CaseContext = {
  caseId: null,
  difficulty: 'resident',
  category: 'any',
  patientName: '',
  chiefConcern: '',
  withGuidance: true,
};

export function useAppRouter() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [caseContext, setCaseContext] = useState<CaseContext>(DEFAULT_CASE_CONTEXT);

  // Navigate to practice list
  const goToPractice = useCallback(() => {
    setCurrentView('practice');
  }, []);

  // Navigate to dashboard
  const goToDashboard = useCallback(() => {
    setCurrentView('dashboard');
  }, []);

  // Navigate to welcome screen (after selecting a case)
  const goToWelcome = useCallback((caseId: string, difficulty?: string, category?: string) => {
    setCaseContext(prev => ({
      ...prev,
      caseId,
      difficulty: difficulty || 'resident',
      category: category || 'any',
      // Generate placeholder patient info (will be replaced by AI-generated case)
      patientName: caseId === 'case-aliyah' ? 'Aliyah Jones' :
                   caseId === 'case-mariana' ? 'Mariana Perez' :
                   caseId === 'case-james' ? 'James Thompson' :
                   caseId === 'case-sarah' ? 'Sarah Mitchell' :
                   caseId === 'case-david' ? 'David Chen' :
                   caseId === 'case-emma' ? 'Emma Rodriguez' : 'Patient',
      chiefConcern: caseId === 'case-aliyah' ? 'Abdominal Pain' :
                    caseId === 'case-mariana' ? 'Cough' :
                    caseId === 'case-james' ? 'Chest Pain' :
                    caseId === 'case-sarah' ? 'Headache' :
                    caseId === 'case-david' ? 'Fever and Rash' :
                    caseId === 'case-emma' ? 'Shortness of Breath' : 'Unknown',
    }));
    setCurrentView('welcome');
  }, []);

  // Start the case (from welcome screen)
  const startCase = useCallback((withGuidance: boolean) => {
    setCaseContext(prev => ({ ...prev, withGuidance }));
    setCurrentView('case');
  }, []);

  // Quick-start: skip welcome, go directly to case generation
  const quickStartPractice = useCallback((difficulty?: string, category?: string) => {
    setCaseContext({
      caseId: null,
      difficulty: difficulty || 'resident',
      category: category || 'any',
      patientName: '',
      chiefConcern: '',
      withGuidance: true,
    });
    setCurrentView('case');
  }, []);

  // Return to dashboard after completing a case
  const exitCase = useCallback(() => {
    setCaseContext(DEFAULT_CASE_CONTEXT);
    setCurrentView('dashboard');
  }, []);

  return {
    currentView,
    caseContext,
    goToDashboard,
    goToPractice,
    goToWelcome,
    startCase,
    quickStartPractice,
    exitCase,
  };
}
