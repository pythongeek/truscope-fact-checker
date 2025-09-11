import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.DAILY_REQUEST_LIMIT': JSON.stringify(env.DAILY_REQUEST_LIMIT),
        'process.env.RATE_LIMIT_WINDOW': JSON.stringify(env.RATE_LIMIT_WINDOW),
        'process.env.MAX_REQUESTS_PER_WINDOW': JSON.stringify(env.MAX_REQUESTS_PER_WINDOW),
        'process.env.ENABLE_CACHING': JSON.stringify(env.ENABLE_CACHING),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
