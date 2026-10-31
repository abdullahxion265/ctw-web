import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // A production build must not ship the placeholder number.
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const n = env.VITE_WHATSAPP_NUMBER || '';
    if (!/^\d{8,15}$/.test(n) || n === '27000000000') {
      throw new Error(
        'Build stopped: set a real VITE_WHATSAPP_NUMBER in client/.env.production ' +
        '(digits only, international format, e.g. 27821234567).'
      );
    }
  }

  return {
    plugins: [react()],
    // Dev server only. Not used by the production build.
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
        '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      },
    },
  };
});
