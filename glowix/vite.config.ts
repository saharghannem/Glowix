import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const countryApiKey = env.VITE_REST_COUNTRIES_API_KEY || env.REST_COUNTRIES_API_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || ''),
      'process.env.VITE_REST_COUNTRIES_API_KEY': JSON.stringify(countryApiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/countries': {
          target: 'https://api.restcountries.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/countries/, '/countries/v5'),
          headers: {
            'Authorization': `Bearer ${countryApiKey}`,
          },
        },
      },
    },
  };
});
