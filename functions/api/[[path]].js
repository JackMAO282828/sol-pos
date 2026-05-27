const DEFAULT_BACKEND_API_ORIGIN = 'https://api.solstake.mom';

export async function onRequest({ request, env }) {
  const backendOrigin = (env.BACKEND_API_ORIGIN || DEFAULT_BACKEND_API_ORIGIN).replace(/\/+$/, '');
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
