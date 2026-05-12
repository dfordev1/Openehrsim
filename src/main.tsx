import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── Sentry ────────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ||
    "https://7c330590e8ef398a2ba6cf908aefed9e@o4511376830038016.ingest.us.sentry.io/4511376836591616",

  sendDefaultPii: true,

  // Trace 10 % of sessions for performance
  tracesSampleRate: 0.1,

  // Full session replay on every error
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,

  // ── Breadcrumb filter: reduce noise from polling / animation frames ──────
  beforeBreadcrumb(breadcrumb) {
    // Drop XHR breadcrumbs for vitals poll (frequent, low-signal)
    if (breadcrumb.category === 'xhr' && breadcrumb.data?.url?.includes('/api/ping')) {
      return null;
    }
    return breadcrumb;
  },

  // ── Event enrichment ─────────────────────────────────────────────────────
  beforeSend(event) {
    // Attach app version so error reports are filterable by release
    if (!event.release && import.meta.env.VITE_APP_VERSION) {
      event.release = import.meta.env.VITE_APP_VERSION;
    }
    return event;
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
