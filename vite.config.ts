import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Sentry source-maps upload — only runs during `vite build` when the
      // auth token is present (CI / Vercel). Silently skipped otherwise.
      ...(env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org:     env.SENTRY_ORG     || 'openehrsim',
              project: env.SENTRY_PROJECT || 'openehrsim-frontend',
              authToken: env.SENTRY_AUTH_TOKEN,
              sourcemaps: { assets: './dist/**' },
              release: { name: env.VITE_APP_VERSION || 'dev' },
            }),
          ]
        : []),
    ],
    // NOTE: GEMINI_API_KEY is server-side only. Never expose it to the client bundle.
    // The /api/consult endpoint handles Gemini calls securely on the server.
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    // Emit source maps so Sentry can map minified errors back to source
    build: {
      sourcemap: true,
    },
    // Vitest config lives here so it picks up the same alias/resolve settings
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'api/**/*.test.ts'],
    },
  };
});
