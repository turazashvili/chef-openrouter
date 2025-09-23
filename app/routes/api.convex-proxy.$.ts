import type { LoaderFunctionArgs } from '@vercel/remix';
import { json } from '@vercel/remix';

// This proxy route handles all /api/convex/* requests and forwards them to api.convex.dev
// with proper Convex Dashboard authentication
export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = `/${params['*'] || ''}`; // Get the catch-all parameter
  
  // Get the Convex OAuth credentials
  const CLIENT_ID = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = globalThis.process.env.CONVEX_OAUTH_CLIENT_SECRET;
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: 'Missing Convex OAuth credentials' }, { status: 500 });
  }

  try {
    // First, get a Convex Dashboard bearer token using client credentials
    const tokenResponse = await fetch('https://api.convex.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get Convex Dashboard token:', errorText);
      return json({ error: 'Failed to authenticate with Convex Dashboard' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const dashboardToken = tokenData.access_token;

    // Now forward the original request to api.convex.dev with the dashboard token
    const targetUrl = `https://api.convex.dev${path}${url.search}`;
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${dashboardToken}`,
        'Content-Type': 'application/json',
        // Forward other relevant headers
        ...(request.headers.get('accept') && { 'Accept': request.headers.get('accept')! }),
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Convex Dashboard API error:', errorText);
      return json({ error: 'Convex Dashboard API error' }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    return json({ error: 'Internal proxy error' }, { status: 500 });
  }
}

// Handle POST requests as well
export async function action({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = `/${params['*'] || ''}`; // Get the catch-all parameter
  
  // Get the Convex OAuth credentials
  const CLIENT_ID = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = globalThis.process.env.CONVEX_OAUTH_CLIENT_SECRET;
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: 'Missing Convex OAuth credentials' }, { status: 500 });
  }

  try {
    // First, get a Convex Dashboard bearer token using client credentials
    const tokenResponse = await fetch('https://api.convex.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get Convex Dashboard token:', errorText);
      return json({ error: 'Failed to authenticate with Convex Dashboard' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const dashboardToken = tokenData.access_token;

    // Now forward the original request to api.convex.dev with the dashboard token
    const targetUrl = `https://api.convex.dev${path}${url.search}`;
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${dashboardToken}`,
        'Content-Type': 'application/json',
        // Forward other relevant headers
        ...(request.headers.get('accept') && { 'Accept': request.headers.get('accept')! }),
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Convex Dashboard API error:', errorText);
      return json({ error: 'Convex Dashboard API error' }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    return json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
