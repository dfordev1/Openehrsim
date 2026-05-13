import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, UserPlus, Fingerprint, ShieldCheck, CheckCircle2, KeyRound } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecovery?: boolean;
  onRecoveryHandled?: () => void;
}

type Mode = 'login' | 'register' | 'forgot' | 'recovery';

export function AuthModal({ isOpen, onClose, isRecovery = false, onRecoveryHandled }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = getSupabase();

  useEffect(() => {
    if (isRecovery) setMode('recovery');
  }, [isRecovery]);

  if (!supabase) return null;

  const reset = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    setMode('login');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        handleClose();
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setSuccess('Account created — check your email to confirm, then sign in.');
        setPassword('');
        setMode('login');
      } else if (mode === 'recovery') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSuccess('Password updated — you are now signed in.');
        setPassword('');
        setConfirmPassword('');
        onRecoveryHandled?.();
        setTimeout(() => handleClose(), 1500);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}`,
        });
        if (error) throw error;
        setSuccess('Password reset link sent — check your inbox.');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const title   = mode === 'login' ? 'Access Portal' : mode === 'register' ? 'Register Account' : mode === 'recovery' ? 'Set New Password' : 'Reset Password';
  const btnIcon = mode === 'login' ? <LogIn className="w-4 h-4" /> : mode === 'register' ? <UserPlus className="w-4 h-4" /> : mode === 'recovery' ? <KeyRound className="w-4 h-4" /> : <Mail className="w-4 h-4" />;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-clinical-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-clinical-surface rounded-xl shadow-2xl z-[201] overflow-hidden"
          >
            <div className="bg-clinical-surface border-b border-clinical-line p-8 text-center relative">
              <div className="w-16 h-16 bg-clinical-blue rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-clinical-blue/20">
                <Fingerprint className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-clinical-ink uppercase tracking-tight">Simulator Access</h2>
              <p className="text-[10px] text-clinical-slate uppercase font-bold tracking-widest mt-1">Personnel Authentication Required</p>
              <button onClick={handleClose} className="absolute top-4 right-4 text-clinical-slate hover:text-clinical-ink transition-colors">
                <ShieldCheck className="w-5 h-5 opacity-40 hover:opacity-100" />
              </button>
            </div>

            <form onSubmit={handleAuth} className="p-8 space-y-6">
              {error && (
                <div className="p-3 bg-clinical-red/10 border border-clinical-red/20 text-clinical-red text-xs rounded font-bold uppercase text-center">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-clinical-green/10 border border-clinical-green/20 text-clinical-green text-xs rounded flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="space-y-4">
                {mode !== 'recovery' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-clinical-slate uppercase tracking-widest ml-1">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-slate" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="name@hospital.tld"
                        className="w-full bg-clinical-bg border border-clinical-line rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-clinical-blue transition-all"
                      />
                    </div>
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-clinical-slate uppercase tracking-widest ml-1">
                      {mode === 'recovery' ? 'New Passphrase' : 'Passphrase'}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-slate" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full bg-clinical-bg border border-clinical-line rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-clinical-blue transition-all"
                      />
                    </div>
                  </div>
                )}

                {mode === 'recovery' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-clinical-slate uppercase tracking-widest ml-1">Confirm Passphrase</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-slate" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full bg-clinical-bg border border-clinical-line rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-clinical-blue transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-clinical-ink text-white rounded-lg font-black uppercase text-xs tracking-widest hover:bg-clinical-blue transition-all flex items-center justify-center gap-2 shadow-xl shadow-clinical-ink/10 disabled:opacity-50"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  : btnIcon}
                {title}
              </button>

              {mode !== 'recovery' && (
                <div className={cn('pt-4 border-t border-clinical-line text-center', mode === 'login' ? 'flex justify-between' : 'flex justify-center')}>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setError(null); setSuccess(null); setMode('forgot'); }}
                      className="text-[10px] font-black text-clinical-slate uppercase tracking-widest hover:text-clinical-blue transition-colors">
                      Forgot Password?
                    </button>
                  )}
                  <button type="button"
                    onClick={() => { setError(null); setSuccess(null); setMode(mode === 'login' ? 'register' : 'login'); }}
                    className="text-[10px] font-black text-clinical-blue uppercase tracking-widest hover:underline">
                    {mode === 'login' ? 'Need New Credentials?' : 'Already Have Clearance?'}
                  </button>
                </div>
              )}
            </form>

            <div className="bg-clinical-bg p-4 flex items-center justify-center gap-3">
              <ShieldCheck className="w-3 h-3 text-clinical-slate opacity-40" />
              <p className="text-[8px] text-clinical-slate uppercase font-bold tracking-widest opacity-60">End-to-End Encryption • HIPAA Compliant Protocols</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
