import { defineConfig } from 'vite';

// Vite's SPA fallback otherwise serves the landing page for public/game/.
function gameDirectoryIndex(req: { url?: string }, _res: unknown, next: () => void) {
  if (req.url && /^\/game\/?(?:\?|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/game\/?/, '/game/index.html');
  }
  next();
}

export default defineConfig({
  // Read VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the project root's .env.local.
  envDir: '..',
  server: { fs: { allow: ['..'] } },
  plugins: [{
    name: 'game-directory-index',
    configureServer(server) { server.middlewares.use(gameDirectoryIndex); },
    configurePreviewServer(server) { server.middlewares.use(gameDirectoryIndex); },
  }],
  build: {
    rollupOptions: { input: { home: 'index.html', auth: 'auth/index.html', languages: 'languages/index.html', map: 'map/index.html', unit: 'unit/index.html' } },
  },
});
