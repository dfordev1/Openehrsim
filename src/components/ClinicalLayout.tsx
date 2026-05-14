/**
 * ClinicalLayout — EHR aesthetic (Epic/Cerner-style).
 * Dense navy banner · tabbed chart · CPOE order entry · flagged results table.
 */

import * as Sentry from '@sentry/react';
import React, {
  Component,
  useEffect,
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
import type { LabResult, ImagingResult, MedicalCase } from '../types';

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:       '#003366',
  navyDark:   '#00264d',
  navyLight:  '#1a5276',
  bannerText: '#ffffff',
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
  font:       'Arial, Helvetica, sans-serif',
  mono:       '"Courier New", Courier, monospace',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function flag(lab: LabResult): string {
  if (lab.status === 'critical') return 'HH';
  if (lab.status === 'abnormal') {
    const v = parseFloat(String(lab.value));
    if (isNaN(v)) return 'H';
    const parts = lab.normalRange.split('-');
    const lo = parseFloat(parts[0]);
    const hi = parseFloat(parts[parts.length - 1]);
    if (!isNaN(lo) && !isNaN(hi)) return v < lo ? 'L' : 'H';
    return 'H';
  }
  return '';
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

// ─── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'chart' | 'orders' | 'results' | 'mar' | 'assessment';

// ─── Main shell ────────────────────────────────────────────────────────────────
function EHRShell() {
  const {
    user, isAuthOpen, setIsAuthOpen, handleLogout,
    isSupabaseConfigured, isAuthLoading, isRecovery, clearRecovery,
  } = useAuth();

  const {
    medicalCase, loading, error, loadingStep, patientOutcome,
    consultantAdvice, isConsulting, isConsultOpen, setIsConsultOpen,
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
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [medicalCase?.clinicalActions?.length]);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (isSupabaseConfigured && !isAuthLoading && !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bodyBg, fontFamily: C.font }}>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} isRecovery={isRecovery} onRecoveryHandled={clearRecovery} />
        <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 32, maxWidth: 360, width: '100%' }}>
          <div style={{ background: C.navy, color: '#fff', padding: '8px 12px', marginBottom: 20, fontSize: 14, fontWeight: 'bold' }}>
            OpenEHR Sim — Clinical Workstation
          </div>
          <p style={{ fontSize: 12, color: '#444', marginBottom: 16 }}>Sign in to access patient cases and track your performance.</p>
          <button onClick={() => setIsAuthOpen(true)} style={{ padding: '6px 16px', fontSize: 12, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isAuthLoading || loading || error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bodyBg, fontFamily: C.font, fontSize: 12 }}>
        {error ? (
          <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 24, maxWidth: 360 }}>
            <p style={{ color: C.critText, fontWeight: 'bold', marginBottom: 8 }}>System Error</p>
            <p style={{ color: '#444', marginBottom: 12 }}>{error}</p>
            <button onClick={() => loadNewCase()} style={{ padding: '4px 12px', fontSize: 12 }}>Retry</button>
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

  function submitOrder() {
    const v = orderInput.trim();
    if (!v || isBusy || !mc) return;
    setOrderInput('');
    handlePerformIntervention(urgency === 'STAT' ? 2 : 5, v);
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
  });

  const vitCell = (label: string, val: string | number, isCrit: boolean, isAbn: boolean): React.ReactNode => (
    <span key={label} style={{
      display: 'inline-block', padding: '2px 10px', marginRight: 4,
      background: isCrit ? C.critBg : isAbn ? C.abnBg : 'transparent',
      color: isCrit ? C.critText : isAbn ? C.abnText : '#111',
      fontWeight: isCrit || isAbn ? 'bold' : 'normal',
      border: `1px solid ${isCrit ? '#ffaaaa' : isAbn ? '#e8c84a' : 'transparent'}`,
      fontSize: 11,
    }}>
      {label}: {val}{(isCrit || isAbn) ? (isCrit ? ' !!!' : ' *') : ''}
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

      {/* ── System header bar ── */}
      <div style={{ background: C.navyDark, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', fontSize: 11, flexShrink: 0 }}>
        <span style={{ fontWeight: 'bold', letterSpacing: 1 }}>OpenEHR Sim — Clinical Decision Support Workstation</span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setIsLibraryOpen(true)} style={{ background: 'none', border: '1px solid #5a8ab0', color: '#cde', padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>New Case</button>
          <button onClick={() => setIsCommandOpen(true)} style={{ background: 'none', border: '1px solid #5a8ab0', color: '#cde', padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>⌘ Commands</button>
          {user && (
            <span style={{ color: '#9bc', fontSize: 10 }}>
              {user.email}
              {' · '}
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#9bc', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}>Sign Out</button>
            </span>
          )}
        </span>
      </div>

      {!mc ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, padding: 24, textAlign: 'center' }}>
            <p style={{ color: C.muted, marginBottom: 12 }}>No patient loaded.</p>
            <button onClick={() => loadNewCase()} style={{ padding: '5px 16px', fontSize: 12, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer' }}>
              Open New Case
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Patient banner ── */}
          <div style={{ background: C.navy, color: '#fff', padding: '6px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>{mc.patientName}</span>
              <span style={{ fontSize: 11, color: '#b8d4f0' }}>
                {mc.age} y/o {mc.gender}
                {' · '}
                MRN: {mc.id.slice(-7).toUpperCase()}
                {mc.difficulty && <span style={{ marginLeft: 8, background: '#1a5276', padding: '1px 6px', fontSize: 10 }}>{mc.difficulty.toUpperCase()}</span>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 3, fontSize: 11, color: '#b8d4f0', flexWrap: 'wrap' }}>
              <span>Location: <strong style={{ color: '#fff' }}>{mc.currentLocation}</strong></span>
              <span>Allergies: <strong style={{ color: '#ffcccc' }}>NKDA</strong></span>
              <span>Code: <strong style={{ color: '#fff' }}>Full</strong></span>
              {mc.specialty_tags && mc.specialty_tags.length > 0 && (
                <span>Specialty: <strong style={{ color: '#fff' }}>{mc.specialty_tags.join(', ')}</strong></span>
              )}
              <span style={{ marginLeft: 'auto', color: '#fff', fontWeight: 'bold' }}>
                T+{simTime} min
                {mc.physiologicalTrend && mc.physiologicalTrend !== 'stable' && (
                  <span style={{ marginLeft: 8, color: mc.physiologicalTrend === 'improving' ? '#90EE90' : '#ff6666' }}>
                    [{mc.physiologicalTrend.toUpperCase()}]
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* ── Vitals strip ── */}
          <div style={{ background: '#dde8f2', borderBottom: `1px solid ${C.border}`, padding: '4px 12px', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: C.muted, marginRight: 4, fontWeight: 'bold' }}>VITALS</span>
            {abn && (
              <>
                {vitCell('HR', `${mc.vitals.heartRate} bpm`, abn.hrC, abn.hr)}
                {vitCell('BP', mc.vitals.bloodPressure, abn.bpC, abn.bp)}
                {vitCell('RR', `${mc.vitals.respiratoryRate}/min`, abn.rrC, abn.rr)}
                {vitCell('SpO2', `${mc.vitals.oxygenSaturation}%`, abn.spo2C, abn.spo2)}
                {vitCell('Temp', `${mc.vitals.temperature}°C`, abn.tempC, abn.temp)}
              </>
            )}
            {patientOutcome && patientOutcome !== 'alive' && (
              <span style={{ marginLeft: 12, background: patientOutcome === 'deceased' ? '#333' : C.critBg, color: patientOutcome === 'deceased' ? '#fff' : C.critText, padding: '2px 8px', fontWeight: 'bold', fontSize: 11 }}>
                ⚠ {patientOutcome === 'deceased' ? 'PATIENT EXPIRED' : 'CRITICAL DETERIORATION'}
              </span>
            )}
            {mc.activeAlarms && mc.activeAlarms.map((alarm, i) => (
              <span key={i} style={{ background: C.critBg, color: C.critText, padding: '1px 6px', fontSize: 10, fontWeight: 'bold', border: `1px solid #ffaaaa` }}>
                ⚡ {alarm}
              </span>
            ))}
          </div>

          {/* ── Tab bar ── */}
          <div style={{ background: C.tabBar, padding: '5px 10px 0', display: 'flex', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
            {(['chart', 'orders', 'results', 'mar', 'assessment'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
                {t === 'chart' && 'Chart Review'}
                {t === 'orders' && `Orders ${(mc.clinicalActions || []).length > 0 ? `(${mc.clinicalActions.length})` : ''}`}
                {t === 'results' && `Results ${availLabs.length + availImgs.length > 0 ? `(${availLabs.length + availImgs.length})` : ''}`}
                {t === 'mar' && `MAR ${activeMeds.length > 0 ? `(${activeMeds.length})` : ''}`}
                {t === 'assessment' && 'Assessment / End Case'}
              </button>
            ))}
          </div>

          {/* ── Main content ── */}
          <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: 12, background: C.bodyBg }}>

            {/* CHART REVIEW */}
            {tab === 'chart' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 1100 }}>
                {/* HPI */}
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, gridColumn: '1 / -1' }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    HISTORY OF PRESENT ILLNESS
                  </div>
                  <div style={{ padding: '8px 10px', lineHeight: 1.6, fontSize: 12 }}>
                    {mc.historyOfPresentIllness}
                  </div>
                  <div style={{ padding: '0 10px 8px' }}>
                    <p style={{ fontSize: 11, fontWeight: 'bold', color: C.muted, marginBottom: 4 }}>Chief Complaint</p>
                    <p style={{ fontSize: 12 }}>{mc.chiefComplaint}</p>
                  </div>
                  {mc.initialAppearance && (
                    <div style={{ padding: '0 10px 8px', borderTop: `1px solid ${C.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 'bold', color: C.muted, marginBottom: 4, marginTop: 6 }}>Initial Appearance</p>
                      <p style={{ fontSize: 12, fontStyle: 'italic' }}>{mc.initialAppearance}</p>
                    </div>
                  )}
                </div>

                {/* PMH */}
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    PAST MEDICAL HISTORY
                  </div>
                  <div style={{ padding: '6px 0' }}>
                    {(mc.pastMedicalHistory || []).map((h, i) => (
                      <div key={i} style={{ padding: '4px 10px', borderBottom: `1px solid #edf2f7`, fontSize: 12, background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                        {h}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Management conflicts */}
                {mc.managementConflicts && mc.managementConflicts.length > 0 && (
                  <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                    <div style={{ background: '#f5e6c8', padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}`, color: '#7d5c00' }}>
                      ⚠ MANAGEMENT CONFLICTS
                    </div>
                    <div style={{ padding: '6px 0' }}>
                      {mc.managementConflicts.map((c, i) => (
                        <div key={i} style={{ padding: '4px 10px', borderBottom: `1px solid #edf2f7`, fontSize: 11, background: C.abnBg, color: C.abnText }}>
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Physical exam */}
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, gridColumn: '1 / -1' }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    PHYSICAL EXAMINATION
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {mc.physicalExam && (Object.entries(mc.physicalExam) as [string, string][]).map(([sys, val], i) => {
                        const locked = val === '[[LOCKED]]';
                        const open = examOpen[sys];
                        return (
                          <tr key={sys} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                            <td style={{ padding: '5px 10px', fontWeight: 'bold', fontSize: 11, color: C.muted, width: 130, borderRight: `1px solid ${C.border}`, verticalAlign: 'top', textTransform: 'uppercase' }}>
                              {sys}
                            </td>
                            <td style={{ padding: '5px 10px', fontSize: 12 }}>
                              {locked ? (
                                <button onClick={() => {
                                  setMedicalCase(prev => prev ? {
                                    ...prev,
                                    clinicalActions: [...(prev.clinicalActions || []), {
                                      id: `exam-${Date.now()}`,
                                      timestamp: prev.simulationTime,
                                      type: 'exam' as const,
                                      description: `Performed physical exam: ${sys}`,
                                    }],
                                  } : prev);
                                  setExamOpen(p => ({ ...p, [sys]: true }));
                                }} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', color: C.navyLight, background: 'none', border: `1px solid ${C.navyLight}` }}>
                                  Perform Exam
                                </button>
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={() => setExamOpen(p => ({ ...p, [sys]: !p[sys] }))}>
                                  {open ? val : val.length > 100 ? val.slice(0, 100) + '… (click to expand)' : val}
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
              <div style={{ maxWidth: 900 }}>
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    ORDER HISTORY
                  </div>
                  {(mc.clinicalActions || []).length === 0 ? (
                    <p style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>No orders placed.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tblHead }}>
                          <th style={th}>Time</th>
                          <th style={th}>Type</th>
                          <th style={{ ...th, width: '60%' }}>Description</th>
                          <th style={th}>Result/Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(mc.clinicalActions || [])].reverse().map((a, i) => (
                          <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                            <td style={td}><span style={{ fontFamily: C.mono, fontSize: 11 }}>T+{a.timestamp}m</span></td>
                            <td style={td}><span style={{ fontSize: 10, background: C.tblHead, padding: '1px 5px' }}>{a.type}</span></td>
                            <td style={td}>{a.description}</td>
                            <td style={{ ...td, color: C.muted, fontStyle: 'italic' }}>{a.impact || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* RESULTS */}
            {tab === 'results' && (
              <div style={{ maxWidth: 1000 }}>
                {/* Lab results */}
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    LABORATORY RESULTS
                  </div>
                  {availLabs.length === 0 && pendLabs.length === 0 ? (
                    <p style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>No labs ordered.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: C.tblHead }}>
                          <th style={{ ...th, width: '30%' }}>Test</th>
                          <th style={th}>Value</th>
                          <th style={th}>Units</th>
                          <th style={th}>Ref Range</th>
                          <th style={th}>Flag</th>
                          <th style={th}>Avail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availLabs.map((l, i) => {
                          const f = flag(l);
                          const isCrit = l.status === 'critical';
                          const isAbn = l.status === 'abnormal';
                          return (
                            <tr key={i} style={{ background: isCrit ? C.critBg : isAbn ? C.abnBg : i % 2 === 0 ? '#fff' : C.tblAlt }}>
                              <td style={td}>{l.name}</td>
                              <td style={{ ...td, fontFamily: C.mono, fontWeight: (isCrit || isAbn) ? 'bold' : 'normal', color: isCrit ? C.critText : isAbn ? C.abnText : '#111' }}>{l.value}</td>
                              <td style={{ ...td, fontFamily: C.mono, color: C.muted }}>{l.unit}</td>
                              <td style={{ ...td, fontFamily: C.mono, color: C.muted }}>{l.normalRange}</td>
                              <td style={{ ...td, fontWeight: 'bold', color: isCrit ? C.critText : isAbn ? C.abnText : C.green, textAlign: 'center' }}>
                                {f || '—'}
                              </td>
                              <td style={{ ...td, fontFamily: C.mono, fontSize: 10, color: C.muted }}>T+{l.availableAt}m</td>
                            </tr>
                          );
                        })}
                        {pendLabs.map((l, i) => (
                          <tr key={`pend-${i}`} style={{ background: '#f0f0f0', color: C.muted }}>
                            <td style={td}>{l.name}</td>
                            <td style={{ ...td, fontStyle: 'italic' }} colSpan={4}>Pending — available T+{l.availableAt}m</td>
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10 }}>T+{l.availableAt}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Imaging */}
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    IMAGING / DIAGNOSTICS
                  </div>
                  {availImgs.length === 0 && pendImgs.length === 0 ? (
                    <p style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>No imaging ordered.</p>
                  ) : (
                    <div>
                      {availImgs.map((img, i) => (
                        <div key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#fff' : C.tblAlt }}>
                          <div
                            style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 12 }}
                            onClick={() => setImgOpen(p => ({ ...p, [img.type]: !p[img.type] }))}
                          >
                            <span>{img.type}</span>
                            <span style={{ color: C.muted, fontWeight: 'normal', fontSize: 10 }}>T+{img.availableAt}m · {imgOpen[img.type] ? '▲ Collapse' : '▼ Expand'}</span>
                          </div>
                          {imgOpen[img.type] && (
                            <div style={{ padding: '4px 10px 10px 20px', fontSize: 12 }}>
                              {img.findings && <p style={{ margin: '4px 0' }}><span style={{ color: C.muted, fontWeight: 'bold' }}>FINDINGS: </span>{img.findings}</p>}
                              {img.impression && <p style={{ margin: '4px 0', fontWeight: 'bold' }}><span style={{ color: C.critText }}>IMPRESSION: </span>{img.impression}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                      {pendImgs.map((img, i) => (
                        <div key={`pi-${i}`} style={{ padding: '6px 10px', background: '#f0f0f0', color: C.muted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                          {img.type} — <em>Pending T+{img.availableAt}m</em>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MAR */}
            {tab === 'mar' && (
              <div style={{ maxWidth: 900 }}>
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    MEDICATION ADMINISTRATION RECORD — ACTIVE
                  </div>
                  {activeMeds.length === 0 ? (
                    <p style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>No active medications.</p>
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
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10 }}>T+{m.timestamp}m</td>
                            <td style={td}>
                              <button onClick={() => handleDiscontinueMedication(m.id, m.name)} style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer', color: C.critText, background: '#fff', border: `1px solid ${C.critText}` }}>
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
                  <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                    <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                      DISCONTINUED MEDICATIONS
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {discMeds.map((m, i) => (
                          <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : C.tblAlt, color: C.muted, textDecoration: 'line-through' }}>
                            <td style={td}>{m.name}</td>
                            <td style={td}>{m.dose} {m.route}</td>
                            <td style={{ ...td, fontFamily: C.mono, fontSize: 10 }}>T+{m.timestamp}m → T+{m.discontinuedAt}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ASSESSMENT */}
            {tab === 'assessment' && (
              <div style={{ maxWidth: 900 }}>
                <div style={{ background: C.panelBg, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                  <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                    CASE ASSESSMENT &amp; SCORING
                  </div>
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
                  <div style={{ background: C.panelBg, border: `1px solid ${C.border}` }}>
                    <div style={{ background: C.tblHead, padding: '4px 10px', fontWeight: 'bold', fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
                      CASE HISTORY
                    </div>
                    <div style={{ padding: 12 }}>
                      <ArchiveView user={user} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Consultant panel (shown in any tab) */}
            {isConsultOpen && (
              <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, background: C.panelBg, border: `1px solid ${C.border}`, borderRight: 'none', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 12px rgba(0,0,0,0.15)' }}>
                <div style={{ background: C.navy, color: '#fff', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: 12 }}>AI CONSULTANT</span>
                  <button onClick={() => setIsConsultOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, fontSize: 12, lineHeight: 1.6 }}>
                  {isConsulting ? (
                    <p style={{ color: C.muted }}>Consulting…</p>
                  ) : consultantAdvice ? (
                    <>
                      <div style={{ background: C.tblAlt, border: `1px solid ${C.border}`, padding: 10, marginBottom: 10, fontStyle: 'italic' }}>
                        {consultantAdvice.advice}
                      </div>
                      <p style={{ marginBottom: 8 }}>{consultantAdvice.reasoning}</p>
                      <p style={{ fontWeight: 'bold', color: C.muted, fontSize: 11, marginBottom: 6 }}>RECOMMENDED ACTIONS</p>
                      <ol style={{ paddingLeft: 18, margin: 0 }}>
                        {consultantAdvice.recommendedActions.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
                      </ol>
                    </>
                  ) : (
                    <p style={{ color: C.muted }}>No consultation yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── CPOE order bar ── */}
          <div style={{ background: '#dde8f2', borderTop: `2px solid ${C.navy}`, padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: C.navy, marginRight: 4 }}>CPOE</span>
            <input
              type="text"
              value={orderInput}
              onChange={e => setOrderInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitOrder()}
              placeholder={isBusy ? 'Processing…' : 'Enter order (e.g. "order CBC STAT", "give Aspirin 325mg", "transfer to ICU")'}
              disabled={isBusy}
              style={{ flex: 1, minWidth: 240, padding: '4px 8px', fontSize: 12, fontFamily: C.font, border: `1px solid ${C.border}`, background: isBusy ? '#eee' : '#fff' }}
            />
            <select value={urgency} onChange={e => setUrgency(e.target.value as 'STAT' | 'Routine')} style={{ padding: '4px 6px', fontSize: 11, border: `1px solid ${C.border}`, background: '#fff', fontFamily: C.font }}>
              <option value="STAT">STAT</option>
              <option value="Routine">Routine</option>
            </select>
            <button onClick={submitOrder} disabled={isBusy || !orderInput.trim()} style={{ padding: '4px 14px', fontSize: 12, background: C.navy, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: C.font }}>
              Place Order
            </button>
            <span style={{ color: C.border, fontSize: 12 }}>|</span>
            <span style={{ fontSize: 11, color: C.muted }}>Advance:</span>
            <select value={advanceMin} onChange={e => setAdvanceMin(Number(e.target.value))} style={{ padding: '4px 6px', fontSize: 11, border: `1px solid ${C.border}`, background: '#fff', fontFamily: C.font }}>
              {[5, 10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}
            </select>
            <button onClick={() => handleAdvanceTime(advanceMin)} disabled={isBusy} style={{ padding: '4px 10px', fontSize: 12, border: `1px solid ${C.border}`, cursor: 'pointer', background: '#fff', fontFamily: C.font }}>
              Advance Time
            </button>
            <span style={{ color: C.border, fontSize: 12 }}>|</span>
            <button onClick={() => handleConsult()} disabled={isBusy} style={{ padding: '4px 10px', fontSize: 12, border: `1px solid ${C.border}`, cursor: 'pointer', background: '#fff', fontFamily: C.font }}>
              Consult AI
            </button>
            <button onClick={() => setIsDxPadOpen(p => !p)} style={{ padding: '4px 10px', fontSize: 12, border: `1px solid ${C.border}`, cursor: 'pointer', background: '#fff', fontFamily: C.font }}>
              Dx Pad
            </button>
            <button onClick={() => setTab('assessment')} style={{ padding: '4px 10px', fontSize: 12, border: `1px solid ${C.navy}`, cursor: 'pointer', background: C.navy, color: '#fff', fontFamily: C.font }}>
              End Case
            </button>
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

// ─── Table cell styles ─────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: 11,
  borderRight: `1px solid ${C.border}`,
  borderBottom: `1px solid ${C.border}`,
  background: C.tblHead,
};

const td: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  borderRight: `1px solid ${C.border}`,
  borderBottom: `1px solid #e8eef3`,
  verticalAlign: 'top',
};
