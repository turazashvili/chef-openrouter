import type { LoaderFunctionArgs } from '@vercel/remix';
import { json } from '@vercel/remix';

// This proxy route handles all /api/convex/* requests and forwards them to api.convex.dev
// with proper Convex Dashboard authentication

async function handleProxyRequest({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = `/${params['*'] || ''}`; // Get the catch-all parameter
  
  console.log('🔍 Proxy route hit:', {
    pathname: url.pathname,
    search: url.search,
    method: request.method,
    catchAllParam: params['*'],
    extractedPath: path
  });
  
  // Get the WorkOS access token from the request headers
  const authHeader = request.headers.get('Authorization');
  console.log('🔑 Authorization header:', {
    hasAuthHeader: !!authHeader,
    authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING'
  });

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Missing or invalid Authorization header');
    return json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const workosToken = authHeader.replace('Bearer ', '');
  console.log('✅ Using WorkOS token for authentication');

  try {
    // First, exchange the WorkOS token for a Convex Dashboard token
    console.log('🔄 Exchanging WorkOS token for Convex Dashboard token...');
    
    const tokenExchangeResponse = await fetch('https://api.convex.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: workosToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        audience: 'https://api.convex.dev',
      }),
    });

    console.log('📡 Token exchange response:', {
      status: tokenExchangeResponse.status,
      statusText: tokenExchangeResponse.statusText,
      ok: tokenExchangeResponse.ok,
      headers: Object.fromEntries(tokenExchangeResponse.headers.entries())
    });

    if (!tokenExchangeResponse.ok) {
      const errorText = await tokenExchangeResponse.text();
      console.error('❌ Failed to exchange WorkOS token:', {
        status: tokenExchangeResponse.status,
        statusText: tokenExchangeResponse.statusText,
        error: errorText
      });
      return json({ error: 'Failed to exchange WorkOS token for Convex Dashboard token' }, { status: 500 });
    }

    const tokenData = await tokenExchangeResponse.json();
    console.log('✅ Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    });
    
    const convexDashboardToken = tokenData.access_token;

    // Now forward the original request to api.convex.dev with the Convex Dashboard token
    const targetUrl = `https://api.convex.dev${path}${url.search}`;
    
    console.log('🔄 Forwarding request:', {
      targetUrl,
      method: request.method,
      path,
      search: url.search
    });
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${convexDashboardToken}`,
        'Content-Type': 'application/json',
        // Forward other relevant headers
        ...(request.headers.get('accept') && { 'Accept': request.headers.get('accept')! }),
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    console.log('📡 Forwarded response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Convex Dashboard API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return json({ error: 'Convex Dashboard API error' }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Successfully forwarded request and got response');
    return json(data);
    
  } catch (error) {
    console.error('💥 Proxy error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return json({ error: 'Internal proxy error' }, { status: 500 });
  }
}

export async function loader(args: LoaderFunctionArgs) {
  return handleProxyRequest(args);
}

// Handle POST requests as well
export async function action(args: LoaderFunctionArgs) {
  return handleProxyRequest(args);
}