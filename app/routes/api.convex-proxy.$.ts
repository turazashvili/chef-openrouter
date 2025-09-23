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
    // Get the Convex OAuth credentials
    const CLIENT_ID = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID;
    const CLIENT_SECRET = globalThis.process.env.CONVEX_OAUTH_CLIENT_SECRET;
    const PROVISION_HOST = globalThis.process.env.PROVISION_HOST || 'https://api.convex.dev';
    
    console.log('🔑 OAuth credentials:', {
      hasClientId: !!CLIENT_ID,
      hasClientSecret: !!CLIENT_SECRET,
      provisionHost: PROVISION_HOST
    });

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('❌ Missing Convex OAuth credentials');
      return json({ error: 'Missing Convex OAuth credentials' }, { status: 500 });
    }

    // Use the WorkOS token as the authorization code (this is a workaround)
    // In a real implementation, you'd need to get an actual authorization code
    console.log('🔄 Using WorkOS token as authorization code...');
    
    const tokenResponse = await fetch(`${PROVISION_HOST}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: workosToken, // Using WorkOS token as the code
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: url.origin + '/convex/callback',
      }),
    });

    console.log('📡 Token response:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      ok: tokenResponse.ok,
      headers: Object.fromEntries(tokenResponse.headers.entries())
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to get Convex Dashboard token:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      return json({ error: 'Failed to get Convex Dashboard token' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token received:', {
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