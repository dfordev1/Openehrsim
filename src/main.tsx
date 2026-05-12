import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── Sentry ────────────────────────────────────────────────────────────────────
// Only initialises when VITE_SENTRY_DSN is set (set it in .env.local and in
// the Vercel dashboard). No-ops silently in local dev without it.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,

    // Capture 10 % of sessions for performance tracing (adjust as needed)
    tracesSampleRate: 0.1,

    // Record a session replay on errors so you can see exactly what happened
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask PII — text and inputs are blocked by default
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Tag every event with the release version (injected by Vite)
    release: import.meta.env.VITE_APP_VERSION || 'dev',

    environment: import.meta.env.MODE, // 'development' | 'production'
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
