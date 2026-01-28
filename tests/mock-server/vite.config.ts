import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function scenarioApi(): Plugin {
  let currentScenario: Record<string, unknown> = {};

  return {
    name: 'scenario-api',
    configureServer(server) {
      server.middlewares.use('/api/scenario', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: string) => body += chunk);
          req.on('end', () => {
            currentScenario = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } else if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(currentScenario));
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), scenarioApi()],
  server: {
    port: 3847,
    strictPort: true,
  },
});
