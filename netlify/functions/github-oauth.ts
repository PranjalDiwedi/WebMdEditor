export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.VITE_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing OAuth authorization code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: 'Missing VITE_GITHUB_CLIENT_SECRET in Netlify Environment Variables. Please add it to Site configuration ➔ Environment variables on Netlify.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Exchange code with GitHub API
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mandrak-App',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      error_description?: string;
      access_token?: string;
      scope?: string;
    };

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error_description || data.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ token: data.access_token, scope: data.scope }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
