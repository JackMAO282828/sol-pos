export async function onRequest({ request, env }) {
  const configuredOrigin = env.BACKEND_API_ORIGIN || env.VITE_API_BASE_URL;
  if (!configuredOrigin) {
    return new Response(JSON.stringify({ error: 'Backend API origin is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const backendOrigin = configuredOrigin.replace(/\/+$/, '');
  const incomingUrl = new URL(request.url);
  const targetUrl = `${backendOrigin}${incomingUrl.pathname}${incomingUrl.search}`;
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  return fetch(new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual'
  }));
}
