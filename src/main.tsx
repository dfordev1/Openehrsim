import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── Sentry ────────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: "https://7c330590e8ef398a2ba6cf908aefed9e@o4511376830038016.ingest.us.sentry.io/4511376836591616",

  // Send default PII (IP address, user agent, etc.)
  sendDefaultPii: true,

  // Capture 10% of sessions for performance tracing
  tracesSampleRate: 0.1,

  // Full session replay on every error so you can see exactly what happened
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  environment: import.meta.env.MODE,            // 'development' | 'production'
  release: import.meta.env.VITE_APP_VERSION,    // optional version tag
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
