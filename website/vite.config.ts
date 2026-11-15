import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';

// `npm run dev` runs the AI market neighbors (api/shopkeeper.ts) the same way Vercel does after deploying.
function shopkeeperApi(server: ViteDevServer) {
  const env = loadEnv(server.config.mode, fileURLToPath(new URL('..', import.meta.url)), '');
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_TTS_MODEL']) if (env[key] && !process.env[key]) process.env[key] = env[key];
  // Each file in api/ answers at /api/<name>, through its GET or POST export (like Vercel functions).
  server.middlewares.use('/api', async (req, res, next) => {
    const name = (req.url ?? '').slice(1).split('?')[0];
    if (!/^[a-z-]+$/.test(name)) return next();
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const route = await server.ssrLoadModule(fileURLToPath(new URL(`../api/${name}.ts`, import.meta.url))).catch(() => undefined);
    const handler = route?.[req.method ?? 'GET'];
    if (!handler) return next();
    const response: Response = await handler(new Request(`http://localhost/api${req.url}`, { method: req.method, headers: { 'content-type': 'application/json' }, body: req.method === 'POST' ? Buffer.concat(chunks).toString() || '{}' : undefined }));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
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
