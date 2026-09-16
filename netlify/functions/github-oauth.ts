interface OAuthResponseData {
  error?: string;
  error_description?: string;
  access_token?: string;
  scope?: string;
}

async function exchangeOAuthCode(
  code: string,
  redirectUri?: string
): Promise<{ status: number; body: { token?: string; scope?: string; error?: string } }> {
  const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.VITE_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

  if (!code) {
    return { status: 400, body: { error: 'Missing OAuth authorization code.' } };
  }

  if (!clientId || !clientSecret) {
    return {
      status: 400,
      body: {
        error:
          'Missing VITE_GITHUB_CLIENT_SECRET in Netlify Environment Variables. Please add it to Site configuration ➔ Environment variables on Netlify.',
      },
    };
  }

  const payload: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };

  if (redirectUri) {
    payload.redirect_uri = redirectUri;
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mandrak-App',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as OAuthResponseData;

  if (data.error) {
    return { status: 400, body: { error: data.error_description || data.error } };
  }

  return {
    status: 200,
    body: { token: data.access_token, scope: data.scope },
  };
}

// Netlify Functions v2 (Standard Web API)
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
    const redirectUri = url.searchParams.get('redirect_uri') || undefined;
    const result = await exchangeOAuthCode(code || '', redirectUri);

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

// Netlify Functions v1 / AWS Lambda format fallback
export const handler = async (event: { httpMethod?: string; queryStringParameters?: Record<string, string> }) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const code = event.queryStringParameters?.code || '';
    const redirectUri = event.queryStringParameters?.redirect_uri || undefined;
    const result = await exchangeOAuthCode(code, redirectUri);

    return {
      statusCode: result.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result.body),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
