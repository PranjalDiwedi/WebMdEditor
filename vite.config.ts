import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'github-oauth-exchange-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/github/oauth/exchange') || req.url.includes('/api/github/oauth/exchange'))) {
              try {
                // Dynamically load fresh .env in case user updated it while dev server is running
                const freshEnv = loadEnv(mode, process.cwd(), '');
                const searchIndex = req.url.indexOf('?');
                const searchParams = new URLSearchParams(searchIndex !== -1 ? req.url.slice(searchIndex) : '');
                const code = searchParams.get('code');
                const clientId =
                  freshEnv.VITE_GITHUB_CLIENT_ID ||
                  env.VITE_GITHUB_CLIENT_ID ||
                  process.env.VITE_GITHUB_CLIENT_ID;
                const clientSecret =
                  freshEnv.VITE_GITHUB_CLIENT_SECRET ||
                  env.VITE_GITHUB_CLIENT_SECRET ||
                  process.env.VITE_GITHUB_CLIENT_SECRET ||
                  freshEnv.GITHUB_CLIENT_SECRET ||
                  env.GITHUB_CLIENT_SECRET;

                if (!code) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Missing OAuth code parameter.' }));
                  return;
                }

                if (!clientId || !clientSecret) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      error:
                        'Missing VITE_GITHUB_CLIENT_SECRET in .env file. Please paste your Client Secret in .env and try again.',
                    })
                  );
                  return;
                }

                // Exchange authorization code for access token via GitHub API
                const githubRes = await fetch('https://github.com/login/oauth/access_token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'User-Agent': 'Mandrak-App',
                  },
                  body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: code,
                  }),
                });

                const data = (await githubRes.json()) as {
                  error?: string;
                  error_description?: string;
                  access_token?: string;
                  scope?: string;
                };
                if (data.error) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: data.error_description || data.error }));
                  return;
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ token: data.access_token, scope: data.scope }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(err) }));
              }
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      proxy: {
        '/api/github/rest': {
          target: 'https://api.github.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/github\/rest/, ''),
          headers: {
            'User-Agent': 'Mandrak-App',
          },
        },
      },
    },
  };
});
