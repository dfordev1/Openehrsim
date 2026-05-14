/**
 * ClinicalLayout — EHR aesthetic v2 (Epic/Cerner-style).
 * Improvements: CPOE autocomplete, quick-order chips, Consult tab,
 * critical-result banner, NEW badges, Examine All, required consultations.
 */

import * as Sentry from '@sentry/react';
import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCase } from '../contexts/CaseContext';
import { useNavigation } from '../contexts/NavigationContext';
import { AuthModal } from './Auth';
import { CaseLibrary } from './CaseLibrary';
import { CommandPalette } from './CommandPalette';
import { AssessmentTab } from './tabs/AssessmentTab';
import { ArchiveView } from './ArchiveView';
import { DiagnosisPad } from './DiagnosisPad';
import { StageCommitGate } from './StageCommitGate';
import type { LabResult, MedicalCase, AvailableTest } from '../types';

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:       '#003366',
  navyDark:   '#00264d',
  navyLight:  '#1a5276',
  tabBar:     '#b8cfe0',
  tabActive:  '#ffffff',
  tabInactive:'#d4e5f2',
  bodyBg:     '#e8eef3',
  panelBg:    '#ffffff',
  border:     '#9ab0c4',
  tblHead:    '#ccdae6',
  tblAlt:     '#f5f8fb',
  abnBg:      '#fffbeb',
  abnText:    '#7d5c00',
  critBg:     '#fff0f0',
  critText:   '#cc0000',
  muted:      '#5a7a96',
  green:      '#1a6e2e',
  blue:       '#0d47a1',
  orange:     '#e65100',
  font:       'Arial, Helvetica, sans-serif',
  mono:       '"Courier New", Courier, monospace',
};

// ─── badge colours per action type ─────────────────────────────────────────────
const actionBadge: Record<string, { bg: string; color: string; label: string }> = {
  order:         { bg: '#e3f2fd', color: '#0d47a1', label: 'ORDER' },
  medication:    { bg: '#e8f5e9', color: '#1a6e2e', label: 'MEDS'  },
  exam:          { bg: '#f3e5f5', color: '#6a1b9a', label: 'EXAM'  },
  procedure:     { bg: '#fff8e1', color: '#f57f17', label: 'PROC'  },
  transfer:      { bg: '#fce4ec', color: '#880e4f', label: 'XFER'  },
  communication: { bg: '#e0f7fa', color: '#006064', label: 'COMM'  },
  'time-advance':{ bg: '#f5f5f5', color: '#757575', label: 'TIME'  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function flag(lab: LabResult): { code: string; color: string; bg: string } {
  if (lab.status === 'critical') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    const low = !isNaN(v) && !isNaN(lo) && v < lo;
    return low
      ? { code: 'LL', color: '#0d47a1', bg: '#e3f2fd' }
      : { code: 'HH', color: C.critText, bg: C.critBg };
  }
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]), hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(v) && !isNaN(lo) && !isNaN(hi))
      return v < lo
        ? { code: 'L', color: '#1565c0', bg: '#e8f0fe' }
        : { code: 'H', color: C.orange, bg: C.abnBg };
    return { code: 'H', color: C.orange, bg: C.abnBg };
  }
  return { code: '', color: C.green, bg: 'transparent' };
}

function vitalsAbnormal(mc: MedicalCase) {
  const v = mc.vitals;
  const sbp = parseInt(mc.vitals.bloodPressure.split('/')[0]) || 120;
  return {
    hr:   v.heartRate > 100 || v.heartRate < 60,
    hrC:  v.heartRate > 150 || v.heartRate < 40,
    bp:   sbp > 140 || sbp < 90,
    bpC:  sbp > 180 || sbp < 80,
    rr:   v.respiratoryRate > 20 || v.respiratoryRate < 12,
    rrC:  v.respiratoryRate > 30 || v.respiratoryRate < 8,
    spo2: v.oxygenSaturation < 95,
    spo2C:v.oxygenSaturation < 88,
    temp: v.temperature > 38.3 || v.temperature < 36,
    tempC:v.temperature > 40 || v.temperature < 34,
  };
}

// ─── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { Sentry.captureException(e, { extra: { componentStack: i.componentStack } }); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, fontFamily: C.font, fontSize: 12 }}>
        <strong>Application Error</strong><br />
        <button onClick={() => window.location.reload()} style={{ marginTop: 8 }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
export function ClinicalLayout() { return <ErrorBoundary><EHRShell /></ErrorBoundary>; }

type Tab = 'chart' | 'orders' | 'results' | 'mar' | 'consult' | 'assessment';

// ─── Main shell ────────────────────────────────────────────────────────────────
function EHRShell() {
  const {
    user, isAuthOpen, setIsAuthOpen, handleLogout,
    isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery,
  } = useAuth();

  const {
    medicalCase, loading, error, loadingStep, patientOutcome,
    consultantAdvice, isConsulting, setIsConsultOpen,
    intervening, userNotes, setUserNotes, evaluation, submitting,
    differential, setDifferential, calling, logs, reasoning,
    isDxPadOpen, setIsDxPadOpen, dxPadInitialTab,
    pendingStage, setPendingStage,
    loadNewCase, handlePerformIntervention, handleConsult,
    handleOrderTest, handleOrderMedication, handleDiscontinueMedication,
    handleAdvanceTime, handleEndCase, setMedicalCase, simTime,
  } = useCase();

  const { isLibraryOpen, setIsLibraryOpen, isCommandOpen, setIsCommandOpen } = useNavigation();

  const [tab, setTab] = useState<Tab>('chart');
  const [orderInput, setOrderInput] = useState('');
  const [urgency, setUrgency] = useState<'STAT' | 'Routine'>('STAT');
  const [advanceMin, setAdvanceMin] = useState(5);
  const [examOpen, setExamOpen] = useState<Record<string, boolean>>({});
  const [imgOpen, setImgOpen] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<AvailableTest[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [critDismissed, setCritDismissed] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLabCount = useRef(0);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [medicalCase?.clinicalActions?.length]);

  // Autocomplete: search availableTests as user types
  const allTests = useMemo((): AvailableTest[] => {
    if (!medicalCase?.availableTests) return [];
    const orderedNames = new Set([
      ...(medicalCase.labs || []).map(l => l.name.toLowerCase()),
      ...(medicalCase.imaging || []).map(i => i.type.toLowerCase()),
    ]);
    return [
      ...(medicalCase.availableTests.labs || [])
        .filter(t => !orderedNames.has(t.name.toLowerCase()))
        .map(t => ({ ...t, _kind: 'lab' as const })),
      ...(medicalCase.availableTests.imaging || [])
        .filter(t => !orderedNames.has(t.name.toLowerCase()))
        .map(t => ({ ...t, _kind: 'imaging' as const })),
    ] as AvailableTest[];
  }, [medicalCase]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setSuggestions([]); setAcOpen(false); return; }
    const lower = q.toLowerCase();
    const results = allTests.filter(t => t.name.toLowerCase().includes(lower)).slice(0, 8);
    setSuggestions(results);
    setAcOpen(results.length > 0);
  }, [allTests]);

  // Quick-order chips — top 4 unordered labs + 2 unordered imaging
  const quickLabs = useMemo(() =>
    (medicalCase?.availableTests?.labs || [])
      .filter(t => !(medicalCase?.labs || []).some(l => l.name.toLowerCase() === t.name.toLowerCase()))
      .slice(0, 4),
    [medicalCase]
  );
  const quickImgs = useMemo(() =>
    (medicalCase?.availableTests?.imaging || [])
      .filter(t => !(medicalCase?.imaging || []).some(i => i.type.toLowerCase() === t.name.toLowerCase()))
      .slice(0, 2),
    [medicalCase]
  );

  // Critical result notifications — new critical labs since last render
  const newCrits = useMemo(() => {
    if (!medicalCase) return [];
    const avail = (medicalCase.labs || []).filter(
      l => l.availableAt !== undefined && l.availableAt <= simTime && l.status === 'critical'
    );
    return avail.filter(l => !critDismissed.has(l.name));
  }, [medicalCase, simTime, critDismissed]);

  // Track result count for tab badge flash
  const availLabCount = medicalCase
    ? (medicalCase.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime).length
    : 0;
  const hasNewResult = availLabCount > prevLabCount.current;
  useEffect(() => { prevLabCount.current = availLabCount; }, [availLabCount]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bodyBg, fontFamily: C.font }}>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 32, maxWidth: 360, width: '100%' }}>
          <div style={{ background: C.navy, color: '#fff', padding: '8px 12px', marginBottom: 20, fontSize: 14, fontWeight: 'bold' }}>
            OpenEHR Sim — Clinical Workstation
          </div>
          <p style={{ fontSize: 12, color: '#444', marginBottom: 16 }}>Sign in to access patient cases and track your performance.</p>
          <button onClick={() => setIsAuthOpen(true)} style={navBtn}>Sign In</button>
        </div>
      </div>
    );
  }

  if (isAuthLoading || loading || error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bodyBg, fontFamily: C.font, fontSize: 12 }}>
        {error ? (
          <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 24, maxWidth: 360 }}>
            <p style={{ color: C.critText, fontWeight: 'bold', marginBottom: 8 }}>System Error</p>
            <p style={{ color: '#444', marginBottom: 12 }}>{error}</p>
            <button onClick={() => loadNewCase()} style={navBtn}>Retry</button>
          </div>
        ) : (
          <p style={{ color: C.muted }}>{loadingStep || 'Loading…'}</p>
        )}
      </div>
    );
  }

  const mc = medicalCase;
  const isBusy = intervening || calling;
  const abn = mc ? vitalsAbnormal(mc) : null;
  const activeMeds = (mc?.medications || []).filter(m => m.discontinuedAt === undefined);
  const discMeds   = (mc?.medications || []).filter(m => m.discontinuedAt !== undefined);
  const availLabs  = (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt <= simTime);
  const pendLabs   = (mc?.labs || []).filter(l => l.availableAt !== undefined && l.availableAt > simTime);
  const availImgs  = (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt <= simTime);
  const pendImgs   = (mc?.imaging || []).filter(i => i.availableAt !== undefined && i.availableAt > simTime);
  const resultCount = availLabs.length + availImgs.length;
  const critCount   = availLabs.filter(l => l.status === 'critical').length;

  function submitOrder() {
    const v = orderInput.trim();
    if (!v || isBusy || !mc) return;
    setOrderInput('');
    setSuggestions([]);
    setAcOpen(false);
    handlePerformIntervention(urgency === 'STAT' ? 2 : 5, v);
  }

  function placeTest(t: AvailableTest & { _kind?: string }) {
    const kind: 'lab' | 'imaging' = (t as any)._kind === 'imaging' ? 'imaging' : 'lab';
    handleOrderTest(kind, t.name);
    setSuggestions([]);
    setAcOpen(false);
    setOrderInput('');
  }

  function examineAll() {
    if (!mc) return;
    const locked = Object.entries(mc.physicalExam || {})
      .filter(([, v]) => v === '[[LOCKED]]')
      .map(([k]) => k);
    if (locked.length === 0) return;
    setMedicalCase(prev => prev ? {
      ...prev,
      clinicalActions: [
        ...(prev.clinicalActions || []),
        ...locked.map((sys, i) => ({
          id: `exam-all-${Date.now()}-${i}`,
          timestamp: prev.simulationTime,
          type: 'exam' as const,
          description: `Performed physical exam: ${sys}`,
        })),
      ],
    } : prev);
    setExamOpen(Object.fromEntries(locked.map(k => [k, true])));
    handlePerformIntervention(3, 'Complete physical examination performed');
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '5px 14px',
    fontSize: 11,
    fontFamily: C.font,
    fontWeight: tab === t ? 'bold' : 'normal',
    background: tab === t ? C.tabActive : C.tabInactive,
    border: `1px solid ${C.border}`,
    borderBottom: tab === t ? `1px solid ${C.panelBg}` : `1px solid ${C.border}`,
    borderTop: tab === t ? `3px solid ${C.navy}` : `1px solid ${C.border}`,
    cursor: 'pointer',
    color: tab === t ? C.navy : '#333',
    marginRight: 2,
    marginBottom: -1,
    position: 'relative',
    whiteSpace: 'nowrap',
  });

  const vitCell = (label: string, val: string | number, isCrit: boolean, isAbn: boolean) => (
    <span key={label} style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', marginRight: 4,
      background: isCrit ? C.critBg : isAbn ? C.abnBg : '#edf3f8',
      color: isCrit ? C.critText : isAbn ? C.abnText : '#1a3a5c',
      fontWeight: isCrit || isAbn ? 'bold' : 'normal',
      border: `1px solid ${isCrit ? '#ffaaaa' : isAbn ? '#e8c84a' : '#c0d4e4'}`,
      fontSize: 12, borderRadius: 2,
    }}>
      <span style={{ fontSize: 10, color: isCrit ? C.critText : isAbn ? C.abnText : C.muted, marginRight: 4 }}>{label}</span>
      {val}
      {isCrit && <span style={{ marginLeft: 4, fontSize: 10 }}>▲▲</span>}
      {!isCrit && isAbn && <span style={{ marginLeft: 4, fontSize: 10 }}>▲</span>}
    </span>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: C.font, fontSize: 12, background: C.bodyBg, color: '#111' }}>

      {/* Global modals */}
      <CaseLibrary isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectCase={(d, c, e) => { setIsLibraryOpen(false); loadNewCase(d, c, e); }} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={() => {}}
        onNewCase={() => setIsLibraryOpen(true)}
        onConsult={handleConsult}
        hasArchive={!!user}
        onOrderTest={mc ? handleOrderTest : undefined}
        onAdminister={mc ? (med) => handlePerformIntervention(2, `Administer ${med}`) : undefined}
        onAdvanceTime={mc ? handleAdvanceTime : undefined}
      />

      {/* ── System header ── */}
      <div style={{ background: C.navyDark, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', fontSize: 11, flexShrink: 0 }}>
        <span style={{ fontWeight: 'bold', letterSpacing: 1 }}>OpenEHR Sim — Clinical Decision Support Workstation</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setIsLibraryOpen(true)} style={sysBtn}>New Case</button>
          <button onClick={() => setIsCommandOpen(true)} style={sysBtn}>⌘ Commands</button>
          <button onClick={() => setIsDxPadOpen(p => !p)} style={sysBtn}>Dx Pad</button>
          {user && <span style={{ color: '#9bc', fontSize: 10 }}>{user.email} · <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#9bc', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}>Sign Out</button></span>}
        </span>
      </div>

      {!mc ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center', maxWidth: 380 }}>
            <div style={{ background: C.navy, color: '#fff', padding: '6px 10px', marginBottom: 16, fontSize: 13, fontWeight: 'bold' }}>No Patient Loaded</div>
            <p style={{ color: C.muted, marginBottom: 16, fontSize: 12 }}>Select a case from the library or generate a new one.</p>
            <button onClick={() => setIsLibraryOpen(true)} style={navBtn}>Browse Case Library</button>
            {' '}
            <button onClick={() => loadNewCase()} style={{ ...navBtn, marginLeft: 8 }}>Generate Case</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Patient banner ── */}
          <div style={{ background: C.navy, color: '#fff', padding: '7px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontWeight: 'bold', fontSize: 15 }}>{mc.patientName}</span>
              <span style={{ fontSize: 11, color: '#b8d4f0' }}>
                {mc.age} y/o {mc.gender}
                {' · '}MRN: {mc.id.slice(-7).toUpperCase()}
              </span>
              {mc.difficulty && (
                <span style={{ background: '#1a5276', padding: '1px 7px', fontSize: 10, borderRadius: 2 }}>
                  {mc.difficulty.toUpperCase()}
                </span>
              )}
              {mc.category && (
                <span style={{ background: '#0d3b6e', padding: '1px 7px', fontSize: 10, borderRadius: 2, color: '#a8d0f0' }}>
                  {mc.category.replace(/_/g, ' ').toUpperCase()}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: simTime >= 60 ? '#ff8080' : simTime >= 30 ? '#ffcc80' : '#90ee90' }}>
                T+{simTime} min
              </span>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#b8d4f0', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>📍 <strong style={{ color: '#fff' }}>{mc.currentLocation}</strong></span>
              <span>⚠ Allergies: <strong style={{ color: '#ffcccc' }}>NKDA</strong></span>
              <span>Code: <strong style={{ color: '#fff' }}>Full Code</strong></span>
              {mc.specialty_tags && mc.specialty_tags.length > 0 && (
                <span>Specialties: <strong style={{ color: '#c8e8ff' }}>{mc.specialty_tags.join(' · ')}</strong></span>
              )}
              {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                <span style={{ background: mc.physiologicalTrend === 'improving' ? '#1a5c2a' : '#7a1a1a', padding: '1px 8px', borderRadius: 2, color: '#fff', fontWeight: 'bold' }}>
                  {mc.physiologicalTrend === 'improving' ? '↑' : mc.physiologicalTrend === 'critical' ? '⚠' : '↓'} {mc.physiologicalTrend.toUpperCase()}
                </span>
              )}
              {patientOutcome && patientOutcome !== 'alive' && (
                <span style={{ background: patientOutcome === 'deceased' ? '#222' : '#8b0000', padding: '2px 10px', borderRadius: 2, fontWeight: 'bold', color: '#fff' }}>
                  ⚠ {patientOutcome === 'deceased' ? 'PATIENT EXPIRED' : 'CRITICAL DETERIORATION'}
                  {' '}
                  <button onClick={() => loadNewCase()} style={{ background: 'none', border: '1px solid #fff', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer', marginLeft: 6 }}>New Case</button>
                </span>
              )}
            </div>
          </div>

          {/* ── Vitals strip ── */}
          <div style={{ background: '#dde8f2', borderBottom: `1px solid ${C.border}`, padding: '5px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 'bold', marginRight: 4, letterSpacing: 1 }}>VITALS</span>
            {abn && (
              <>
                {vitCell('HR', `${mc.vitals.heartRate} bpm`,          abn.hrC,   abn.hr)}
                {vitCell('BP', mc.vitals.bloodPressure,                abn.bpC,   abn.bp)}
                {vitCell('RR', `${mc.vitals.respiratoryRate}/min`,     abn.rrC,   abn.rr)}
                {vitCell('SpO₂', `${mc.vitals.oxygenSaturation}%`,    abn.spo2C, abn.spo2)}
                {vitCell('Temp', `${mc.vitals.temperature}°C`,         abn.tempC, abn.temp)}
                {mc.vitals.weightKg && vitCell('Wt', `${mc.vitals.weightKg}kg`, false, false)}
              </>
            )}
            {mc.activeAlarms && mc.activeAlarms.map((alarm, i) => (
              <span key={i} style={{ background: C.critBg, color: C.critText, padding: '2px 8px', fontSize: 10, fontWeight: 'bold', border: `1px solid #ffaaaa`, borderRadius: 2 }}>
                ⚡ {alarm}
              </span>
            ))}
            {mc.currentCondition && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>{mc.currentCondition}</span>
            )}
          </div>

          {/* ── Critical result alert banner ── */}
          {newCrits.length > 0 && (
            <div style={{ background: '#ffebee', borderBottom: `2px solid ${C.critText}`, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ color: C.critText, fontWeight: 'bold', fontSize: 11 }}>⚠ CRITICAL RESULT{newCrits.length > 1 ? 'S' : ''}</span>
              {newCrits.slice(0, 3).map(l => (
                <span key={l.name} style={{ color: C.critText, fontSize: 11 }}>
                  {l.name}: <strong>{l.value} {l.unit}</strong> (ref {l.normalRange})
                </span>
              ))}
              <button onClick={() => { setTab('results'); setCritDismissed(p => new Set([...p, ...newCrits.map(l => l.name)])); }} style={{ background: C.critText, color: '#fff', border: 'none', padding: '2px 10px', fontSize: 11, cursor: 'pointer', marginLeft: 'auto', borderRadius: 2 }}>
                View Results →
              </button>
              <button onClick={() => setCritDismissed(p => new Set([...p, ...newCrits.map(l => l.name)]))} style={{ background: 'none', border: `1px solid ${C.critText}`, color: C.critText, padding: '2px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 2 }}>
                Dismiss
              </button>
            </div>
          )}

          {/* ── Tab bar ── */}
          <div style={{ background: C.tabBar, padding: '5px 10px 0', display: 'flex', flexShrink: 0, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
            {(['chart', 'orders', 'results', 'mar', 'consult', 'assessment'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
                {t === 'chart'      && 'Chart Review'}
                {t === 'orders'     && <>Orders {(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length > 0 && <TabBadge n={(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length} color={C.blue} />}</>}
                {t === 'results'    && <>Results {resultCount > 0 && <TabBadge n={resultCount} color={critCount > 0 ? C.critText : C.green} />}{hasNewResult && tab !== 'results' && <span style={{ marginLeft: 4, fontSize: 9, color: C.critText, fontWeight: 'bold' }}>●NEW</span>}</>}
                {t === 'mar'        && <>MAR {activeMeds.length > 0 && <TabBadge n={activeMeds.length} color={C.green} />}</>}
                {t === 'consult'    && <>Consult {isConsulting && <span style={{ marginLeft: 4, fontSize: 9, color: C.orange }}>●</span>}</>}
                {t === 'assessment' && 'Assessment'}
              </button>
            ))}
          </div>

          {/* ── Main content ── */}
          <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: 12, background: C.bodyBg }}>

            {/* CHART REVIEW */}
            {tab === 'chart' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 1200 }}>

                {/* HPI */}
                <div style={{ ...panel, gridColumn: '1 / -1' }}>
                  <PanelHead>HISTORY OF PRESENT ILLNESS</PanelHead>
                  <div style={{ padding: '8px 12px 4px', lineHeight: 1.7, fontSize: 12 }}>
                    {mc.historyOfPresentIllness}
                  </div>
                  <div style={{ padding: '4px 12px 8px', borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: C.muted }}>Chief Complaint: </span>
                    <span style={{ fontSize: 12 }}>{mc.chiefComplaint}</span>
                  </div>
                  {mc.initialAppearance && (
                    <div style={{ padding: '4px 12px 8px', borderTop: `1px solid ${C.border}`, background: '#fafcff' }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: C.muted }}>Initial Appearance: </span>
                      <span style={{ fontSize: 12, fontStyle: 'italic' }}>{mc.initialAppearance}</span>
                    </div>
                  )}
                </div>

                {/* PMH + required consultations */}
                <div style={panel}>
                  <PanelHead>PAST MEDICAL HISTORY</PanelHead>
                  {(mc.pastMedicalHistory || []).map((h, i) => (
                    <div key={i} style={{ padding: '5px 12px', borderBottom: `1px solid #edf2f7`, fontSize: 12, background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                      {h}
                    </div>
                  ))}
                  {mc.requiredConsultations && mc.requiredConsultations.length > 0 && (
                    <>
                      <div style={{ background: '#e8f5e9', padding: '4px 12px', fontWeight: 'bold', fontSize: 11, borderTop: `1px solid ${C.border}`, color: C.green }}>
                        RECOMMENDED CONSULTATIONS
                      </div>
                      {mc.requiredConsultations.map((c, i) => (
                        <div key={i} style={{ padding: '4px 12px', borderBottom: `1px solid #edf2f7`, fontSize: 12, background: i % 2 === 0 ? '#f1faf3' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{c}</span>
                          <button onClick={() => { handleConsult(); setTab('consult'); }} style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer', color: C.green, background: '#e8f5e9', border: `1px solid ${C.green}`, borderRadius: 2 }}>
                            Consult →
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Management conflicts */}
                {mc.managementConflicts && mc.managementConflicts.length > 0 && (
                  <div style={panel}>
                    <PanelHead style={{ background: '#fff3e0', color: '#e65100' }}>⚠ ACTIVE MANAGEMENT CONFLICTS</PanelHead>
                    {mc.managementConflicts.map((c, i) => (
                      <div key={i} style={{ padding: '6px 12px', borderBottom: `1px solid #ffe0b2`, fontSize: 11, background: i % 2 === 0 ? C.abnBg : '#fffde7', color: C.abnText, lineHeight: 1.5 }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}

                {/* Physical exam */}
                <div style={{ ...panel, gridColumn: '1 / -1' }}>
                  <div style={{ ...panelHeadStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>PHYSICAL EXAMINATION</span>
                    {mc.physicalExam && Object.values(mc.physicalExam).some(v => v === '[[LOCKED]]') && (
                      <button onClick={examineAll} disabled={isBusy} style={{ fontSize: 11, padding: '2px 10px', cursor: 'pointer', color: C.navy, background: '#fff', border: `1px solid ${C.navy}`, borderRadius: 2 }}>
                        Examine All Systems
                      </button>
                    )}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {mc.physicalExam && (Object.entries(mc.physicalExam) as [string, string][]).map(([sys, val], i) => {
                        const locked = val === '[[LOCKED]]';
                        const open = examOpen[sys];
                        return (
                          <tr key={sys} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                            <td style={{ padding: '5px 12px', fontWeight: 'bold', fontSize: 11, color: C.muted, width: 140, borderRight: `1px solid ${C.border}`, verticalAlign: 'top', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {sys}
                            </td>
                            <td style={{ padding: '5px 12px', fontSize: 12, lineHeight: 1.5 }}>
                              {locked ? (
                                <button onClick={() => {
                                  setMedicalCase(prev => prev ? { ...prev, clinicalActions: [...(prev.clinicalActions || []), { id: `exam-${Date.now()}`, timestamp: prev.simulationTime, type: 'exam' as const, description: `Performed physical exam: ${sys}` }] } : prev);
                                  setExamOpen(p => ({ ...p, [sys]: true }));
                                }} style={{ fontSize: 11, padding: '2px 10px', cursor: 'pointer', color: C.navyLight, background: '#e8f0fe', border: `1px solid ${C.navyLight}`, borderRadius: 2 }}>
                                  Perform Exam
                                </button>
                              ) : (
                                <span style={{ cursor: val.length > 120 ? 'pointer' : 'default' }} onClick={() => val.length > 120 && setExamOpen(p => ({ ...p, [sys]: !p[sys] }))}>
                                  {open || val.length <= 120 ? val : val.slice(0, 120) + '…'}
                                  {val.length > 120 && <span style={{ color: C.muted, fontSize: 10, marginLeft: 6 }}>{open ? '(collapse)' : '(expand)'}</span>}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {tab === 'orders' && (
              <div style={{ maxWidth: 960 }}>
                <div style={panel}>
                  <PanelHead>ORDER HISTORY</PanelHead>
                  {(mc.clinicalActions || []).filter(a => a.type !== 'time-advance').length === 0 ? (
                    <p style={{ padding: '14px 12px', color: C.muted, fontSize: 12 }}>No orders placed yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tblHead }}>
                          <th style={th}>Time</th>
                          <th style={th}>Type</th>
                          <th style={{ ...th, width: '55%' }}>Order / Action</th>
                          <th style={th}>Result / Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(mc.clinicalActions || [])].filter(a => a.type !== 'time-advance').reverse().map((a, i) => {
                          const badge = actionBadge[a.type] || { bg: C.tblHead, color: '#333', label: a.type.toUpperCase() };
                          return (
                            <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                              <td style={td}><span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted }}>T+{a.timestamp}m</span></td>
                              <td style={td}>
                                <span style={{ fontSize: 10, background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: 2, fontWeight: 'bold' }}>{badge.label}</span>
                              </td>
                              <td style={td}>{a.description}</td>
                              <td style={{ ...td, color: C.muted, fontStyle: 'italic', fontSize: 11 }}>{a.impact || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* RESULTS */}
            {tab === 'results' && (
              <div style={{ maxWidth: 1100 }}>
                {/* Lab results */}
                <div style={{ ...panel, marginBottom: 10 }}>
                  <PanelHead>LABORATORY RESULTS {critCount > 0 && <span style={{ marginLeft: 8, background: C.critText, color: '#fff', padding: '1px 6px', borderRadius: 2, fontSize: 10 }}>⚠ {critCount} CRITICAL</span>}</PanelHead>
                  {availLabs.length === 0 && pendLabs.length === 0 ? (
                    <p style={{ padding: '14px 12px', color: C.muted, fontSize: 12 }}>No labs ordered yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tblHead }}>
                          <th style={{ ...th, width: '30%' }}>Test Name</th>
                          <th style={th}>Result</th>
                          <th style={th}>Units</th>
                          <th style={th}>Reference Range</th>
                          <th style={{ ...th, textAlign: 'center', width: 60 }}>Flag</th>
                          <th style={th}>Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availLabs.map((l, i) => {
                          const f = flag(l);
                          const isCrit = l.status === 'critical';
                          const isAbn  = l.status === 'abnormal';
                          return (
                            <tr key={i} style={{ background: isCrit ? C.critBg : isAbn ? C.abnBg : i % 2 === 0 ? '#fff' : C.tblAlt }}>
                              <td style={td}>{l.name}</td>
                              <td style={{ ...td, fontFamily: C.mono, fontWeight: (isCrit || isAbn) ? 'bold' : 'normal', color: isCrit ? C.critText : isAbn ? C.abnText : '#111', fontSize: 13 }}>
                                {l.value}
                              </td>
                              <td style={{ ...td, fontFamily: C.mono, color: C.muted }}>{l.unit}</td>
                              <td style={{ ...td, fontFamily: C.mono, color: C.muted }}>{l.normalRange}</td>
                              <td style={{ ...td, textAlign: 'center' }}>
                                {f.code ? (
                                  <span style={{ background: f.bg, color: f.color, padding: '2px 6px', borderRadius: 2, fontWeight: 'bold', fontSize: 11, display: 'inline-block' }}>
                                    {f.code}
                                  </span>
                                ) : (
                                  <span style={{ color: C.green, fontSize: 12 }}>—</span>
                                )}
                              </td>
                              <td style={{ ...td, fontFamily: C.mono, fontSize: 10, color: C.muted }}>T+{l.availableAt}m</td>
                            </tr>
                          );
                        })}
                        {pendLabs.map((l, i) => (
                          <tr key={`pend-${i}`} style={{ background: '#f7f9fb', color: C.muted }}>
                            <td style={td}>{l.name}</td>
                            <td style={{ ...td, fontStyle: 'italic' }} colSpan={4}>Pending — ETA T+{l.availableAt}m ({Math.max(0, (l.availableAt ?? 0) - simTime)} min)</td>
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10 }}>T+{l.availableAt}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Imaging */}
                <div style={panel}>
                  <PanelHead>IMAGING &amp; DIAGNOSTICS</PanelHead>
                  {availImgs.length === 0 && pendImgs.length === 0 ? (
                    <p style={{ padding: '14px 12px', color: C.muted, fontSize: 12 }}>No imaging ordered yet.</p>
                  ) : (
                    <>
                      {availImgs.map((img, i) => (
                        <div key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                          <div
                            style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: 12 }}>{img.type}</span>
                            <span style={{ color: C.muted, fontSize: 10 }}>T+{img.availableAt}m · {imgOpen[img.type] ? '▲ Collapse' : '▼ Expand report'}</span>
                          </div>
                          {imgOpen[img.type] && (
                            <div style={{ padding: '4px 20px 12px', fontSize: 12, borderTop: `1px solid ${C.border}`, background: '#fafcff' }}>
                              {img.findings && <p style={{ margin: '6px 0', lineHeight: 1.6 }}><span style={{ color: C.muted, fontWeight: 'bold', fontSize: 11 }}>FINDINGS: </span>{img.findings}</p>}
                              {img.impression && <p style={{ margin: '6px 0', fontWeight: 'bold', lineHeight: 1.6 }}><span style={{ color: C.critText }}>IMPRESSION: </span>{img.impression}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                      {pendImgs.map((img, i) => (
                        <div key={`pi-${i}`} style={{ padding: '7px 12px', background: '#f7f9fb', color: C.muted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                          {img.type} — <em>Pending ETA T+{img.availableAt}m ({Math.max(0, (img.availableAt ?? 0) - simTime)} min)</em>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* MAR */}
            {tab === 'mar' && (
              <div style={{ maxWidth: 960 }}>
                <div style={{ ...panel, marginBottom: 10 }}>
                  <PanelHead>MEDICATION ADMINISTRATION RECORD — ACTIVE ({activeMeds.length})</PanelHead>
                  {activeMeds.length === 0 ? (
                    <p style={{ padding: '14px 12px', color: C.muted, fontSize: 12 }}>No active medications.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tblHead }}>
                          <th style={{ ...th, width: '35%' }}>Medication</th>
                          <th style={th}>Dose</th>
                          <th style={th}>Route</th>
                          <th style={th}>Started</th>
                          <th style={th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMeds.map((m, i) => (
                          <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                            <td style={{ ...td, fontWeight: 'bold' }}>{m.name}</td>
                            <td style={td}>{m.dose}</td>
                            <td style={td}>{m.route}</td>
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10, color: C.muted }}>T+{m.timestamp}m</td>
                            <td style={td}>
                              <button onClick={() => handleDiscontinueMedication(m.id, m.name)} style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', color: C.critText, background: C.critBg, border: `1px solid #ffaaaa`, borderRadius: 2 }}>
                                Discontinue
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {discMeds.length > 0 && (
                  <div style={panel}>
                    <PanelHead style={{ color: C.muted }}>DISCONTINUED MEDICATIONS</PanelHead>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {discMeds.map((m, i) => (
                          <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt, color: C.muted }}>
                            <td style={td}><s>{m.name}</s></td>
                            <td style={td}><s>{m.dose} {m.route}</s></td>
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10 }}>T+{m.timestamp}m → T+{m.discontinuedAt}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CONSULT */}
            {tab === 'consult' && (
              <div style={{ maxWidth: 800 }}>
                <div style={panel}>
                  <div style={{ ...panelHeadStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>AI CONSULTANT</span>
                    <button onClick={() => handleConsult()} disabled={isBusy || isConsulting} style={{ fontSize: 11, padding: '2px 12px', cursor: 'pointer', color: '#fff', background: C.navy, border: 'none', borderRadius: 2 }}>
                      {isConsulting ? 'Consulting…' : 'Request Consult'}
                    </button>
                  </div>
                  {isConsulting ? (
                    <p style={{ padding: '20px 12px', color: C.muted, textAlign: 'center' }}>Awaiting consultant response…</p>
                  ) : consultantAdvice ? (
                    <div style={{ padding: 12 }}>
                      <div style={{ background: '#f0f7ff', border: `1px solid ${C.border}`, padding: 12, marginBottom: 12, lineHeight: 1.7, fontSize: 13, fontStyle: 'italic' }}>
                        "{consultantAdvice.advice}"
                      </div>
                      <p style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>{consultantAdvice.reasoning}</p>
                      <div style={{ fontWeight: 'bold', fontSize: 11, color: C.muted, marginBottom: 6 }}>RECOMMENDED ACTIONS</div>
                      {consultantAdvice.recommendedActions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                          <span style={{ background: C.navy, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                          <span style={{ fontSize: 12, lineHeight: 1.6 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '30px 12px', color: C.muted, textAlign: 'center' }}>
                      <p style={{ marginBottom: 12 }}>No consultation requested yet.</p>
                      <button onClick={() => handleConsult()} disabled={isBusy} style={{ ...navBtn }}>Request AI Consult</button>
                    </div>
                  )}
                </div>

                {/* Required consultations reminder */}
                {mc.requiredConsultations && mc.requiredConsultations.length > 0 && (
                  <div style={{ ...panel, marginTop: 10 }}>
                    <PanelHead>SUBSPECIALTY CONSULTATIONS REQUIRED FOR THIS CASE</PanelHead>
                    {mc.requiredConsultations.map((c, i) => (
                      <div key={i} style={{ padding: '6px 12px', borderBottom: `1px solid #edf2f7`, fontSize: 12, background: i % 2 === 0 ? '#f1faf3' : '#fff' }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ASSESSMENT */}
            {tab === 'assessment' && (
              <div style={{ maxWidth: 960 }}>
                <div style={{ ...panel, marginBottom: 10 }}>
                  <PanelHead>CASE ASSESSMENT &amp; SCORING</PanelHead>
                  <div style={{ padding: 12 }}>
                    <AssessmentTab
                      medicalCase={mc}
                      simTime={simTime}
                      userNotes={userNotes}
                      evaluation={evaluation}
                      submitting={submitting}
                      logs={logs}
                      differential={differential}
                      onDifferentialChange={setDifferential}
                      onNotesChange={setUserNotes}
                      onEndCase={handleEndCase}
                      onNewCase={() => loadNewCase()}
                    />
                  </div>
                </div>
                {user && (
                  <div style={panel}>
                    <PanelHead>PERFORMANCE HISTORY</PanelHead>
                    <div style={{ padding: 12 }}>
                      <ArchiveView user={user} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Quick-order chips ── */}
          {(quickLabs.length > 0 || quickImgs.length > 0) && (
            <div style={{ background: '#f0f5fa', borderTop: `1px solid ${C.border}`, padding: '4px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: C.muted, marginRight: 2 }}>Quick order:</span>
              {quickLabs.slice(0, 5).map(t => (
                <button key={t.name} onClick={() => handleOrderTest('lab', t.name)} disabled={isBusy} style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', color: C.blue, background: '#e3f2fd', border: `1px solid #90caf9`, borderRadius: 10, whiteSpace: 'nowrap' }}>
                  + {t.name}
                </button>
              ))}
              {quickImgs.slice(0, 3).map(t => (
                <button key={t.name} onClick={() => handleOrderTest('imaging', t.name)} disabled={isBusy} style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', color: '#6a1b9a', background: '#f3e5f5', border: `1px solid #ce93d8`, borderRadius: 10, whiteSpace: 'nowrap' }}>
                  + {t.name}
                </button>
              ))}
            </div>
          )}

          {/* ── CPOE order bar ── */}
          <div style={{ background: '#dde8f2', borderTop: `2px solid ${C.navy}`, padding: '7px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 'bold', color: C.navy, letterSpacing: 1 }}>CPOE</span>
              <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={orderInput}
                  onChange={e => { setOrderInput(e.target.value); search(e.target.value); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitOrder();
                    if (e.key === 'Escape') { setSuggestions([]); setAcOpen(false); }
                  }}
                  placeholder={isBusy ? 'Processing…' : 'Search or enter order (lab, imaging, medication, procedure…)'}
                  disabled={isBusy}
                  style={{ width: '100%', padding: '5px 10px', fontSize: 12, fontFamily: C.font, border: `1px solid ${C.border}`, background: isBusy ? '#eee' : '#fff', boxSizing: 'border-box' }}
                />
                {/* Autocomplete dropdown */}
                {acOpen && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
                    {suggestions.map(s => {
                      const kind: 'lab' | 'imaging' = (s as any)._kind === 'imaging' ? 'imaging' : 'lab';
                      return (
                        <button key={s.name} onClick={() => placeTest(s as any)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '6px 10px', background: 'none', border: 'none', borderBottom: `1px solid #f0f0f0`, cursor: 'pointer', textAlign: 'left', fontFamily: C.font, fontSize: 12 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span>{s.name}</span>
                          <span style={{ fontSize: 10, color: kind === 'lab' ? C.blue : '#6a1b9a', background: kind === 'lab' ? '#e3f2fd' : '#f3e5f5', padding: '1px 6px', borderRadius: 8, marginLeft: 8 }}>
                            {kind} · STAT {s.stat}m
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <select value={urgency} onChange={e => setUrgency(e.target.value as 'STAT' | 'Routine')} style={{ padding: '5px 8px', fontSize: 11, border: `1px solid ${C.border}`, background: '#fff', fontFamily: C.font }}>
                <option value="STAT">STAT</option>
                <option value="Routine">Routine</option>
              </select>
              <button onClick={submitOrder} disabled={isBusy || !orderInput.trim()} style={{ padding: '5px 16px', fontSize: 12, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: C.font, borderRadius: 2 }}>
                Place Order
              </button>
              <span style={{ color: C.border }}>|</span>
              <span style={{ fontSize: 11, color: C.muted }}>Advance:</span>
              <select value={advanceMin} onChange={e => setAdvanceMin(Number(e.target.value))} style={{ padding: '5px 6px', fontSize: 11, border: `1px solid ${C.border}`, background: '#fff', fontFamily: C.font }}>
                {[5, 10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
              </select>
              <button onClick={() => handleAdvanceTime(advanceMin)} disabled={isBusy} style={{ padding: '5px 10px', fontSize: 12, border: `1px solid ${C.border}`, cursor: 'pointer', background: '#fff', fontFamily: C.font, borderRadius: 2 }}>
                Advance Time
              </button>
              <span style={{ color: C.border }}>|</span>
              <button onClick={() => setTab('assessment')} style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${C.navy}`, cursor: 'pointer', background: C.navy, color: '#fff', fontFamily: C.font, borderRadius: 2 }}>
                End Case
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DiagnosisPad ── */}
      {mc && (
        <DiagnosisPad
          isOpen={isDxPadOpen}
          onToggle={() => setIsDxPadOpen(p => !p)}
          initialTab={dxPadInitialTab}
          problemRepresentation={reasoning.problemRepresentation}
          onProblemRepresentationChange={reasoning.setProblemRepresentation}
          prHistory={reasoning.prHistory}
          prIsDirty={reasoning.prIsDirty}
          currentStage={reasoning.currentStage}
          differentials={reasoning.differentials}
          onAddDifferential={reasoning.addDifferential}
          onRemoveDifferential={reasoning.removeDifferential}
          onSetLeadDiagnosis={reasoning.setLeadDiagnosis}
          onUpdateConfidence={reasoning.updateConfidence}
          onSetIllnessScript={reasoning.setIllnessScript}
          findings={reasoning.findings}
          onRemoveFinding={reasoning.removeFinding}
          onUpdateRelevance={reasoning.updateRelevance}
          onUpdateFindingRelevanceForDx={reasoning.updateFindingRelevanceForDx}
        />
      )}

      {/* ── Stage Commit Gate ── */}
      {mc && pendingStage && (
        <StageCommitGate
          isOpen={!!pendingStage}
          fromStage={reasoning.currentStage}
          toStage={pendingStage}
          problemRepresentation={reasoning.problemRepresentation}
          onProblemRepresentationChange={reasoning.setProblemRepresentation}
          differentials={reasoning.differentials}
          onSetLead={reasoning.setLeadDiagnosis}
          findings={reasoning.findings}
          previousPrSnapshot={reasoning.latestPrSnapshot}
          unmetRequirements={reasoning.checkStageGate(reasoning.currentStage)}
          onCommit={(fromStage) => {
            const snapId = reasoning.commitStage(fromStage, simTime);
            if (snapId && pendingStage) { reasoning.goToStage(pendingStage); setPendingStage(null); }
            return snapId;
          }}
          onCancel={() => setPendingStage(null)}
        />
      )}
    </div>
  );
}

// ─── Small components ──────────────────────────────────────────────────────────
function TabBadge({ n, color }: { n: number; color: string }) {
  return (
    <span style={{ marginLeft: 5, background: color, color: '#fff', borderRadius: 8, padding: '0px 5px', fontSize: 9, fontWeight: 'bold', display: 'inline-block', verticalAlign: 'middle' }}>
      {n}
    </span>
  );
}

function PanelHead({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...panelHeadStyle, ...style }}>
      {children}
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const panelHeadStyle: React.CSSProperties = {
  background: C.tblHead,
  padding: '5px 12px',
  fontWeight: 'bold',
  fontSize: 11,
  borderBottom: `1px solid ${C.border}`,
  letterSpacing: 0.5,
  color: '#1a3a5c',
};

const panel: React.CSSProperties = {
  background: C.panelBg,
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
};

const th: React.CSSProperties = {
  padding: '5px 10px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: 11,
  borderRight: `1px solid ${C.border}`,
  borderBottom: `1px solid ${C.border}`,
  background: C.tblHead,
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  borderRight: `1px solid ${C.border}`,
  borderBottom: `1px solid #e8eef3`,
  verticalAlign: 'top',
};

const navBtn: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 12,
  background: C.navy,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 2,
};

const sysBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid #5a8ab0',
  color: '#cde',
  padding: '2px 8px',
  fontSize: 10,
  cursor: 'pointer',
  borderRadius: 2,
};
