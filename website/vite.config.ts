import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';

// `npm run dev` runs the AI market neighbors (api/shopkeeper.ts) the same way Vercel does after deploying.
function shopkeeperApi(server: ViteDevServer) {
  const env = loadEnv(server.config.mode, fileURLToPath(new URL('..', import.meta.url)), '');
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL']) if (env[key] && !process.env[key]) process.env[key] = env[key];
  server.middlewares.use('/api/shopkeeper', async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const { POST } = await server.ssrLoadModule(fileURLToPath(new URL('../api/shopkeeper.ts', import.meta.url)));
    const response: Response = await POST(new Request('http://localhost/api/shopkeeper', { method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks).toString() || '{}' }));
    res.statusCode = response.status; res.setHeader('content-type', 'application/json'); res.end(await response.text());
  });
}

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
    configureServer(server) { shopkeeperApi(server); server.middlewares.use(gameDirectoryIndex); },
    configurePreviewServer(server) { server.middlewares.use(gameDirectoryIndex); },
  }],
  build: {
    rollupOptions: { input: { home: 'index.html', auth: 'auth/index.html', languages: 'languages/index.html', map: 'map/index.html', unit: 'unit/index.html' } },
  },
});
