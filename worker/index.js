/**
 * desktopCAM på Cloudflare Workers.
 *
 * Appen är statiska filer (apps/web/dist). Den här koden körs bara för
 * /api/* (wrangler.jsonc: assets.run_worker_first) och tar emot felrapporter
 * som användaren själv valt att skicka. Rapporten skrivs till Workers Logs
 * (Cloudflare-panelen → Workers → desktopcam → Logs), som sparar loggar i
 * upp till 7 dagar. Ingen tredjepartstjänst, inga cookies.
 *
 * Integritet: bara fälten nedan sparas, med begränsad längd. IP-adress och
 * andra uppgifter om anropet loggas inte (observability.logs.invocation_logs = false).
 */

const MAX_BODY = 16_000;
const FIELDS = { version: 20, language: 8, machineKind: 16, where: 16, browser: 40, message: 500, stack: 4000, path: 80 };

/** Bara kända fält, som text, med begränsad längd. */
function sanitize(input) {
  const out = {};
  for (const [key, max] of Object.entries(FIELDS)) {
    const v = input?.[key];
    if (typeof v === 'string' && v) out[key] = v.slice(0, max);
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/error') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
      if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
      let body;
      try {
        const text = await request.text();
        if (text.length > MAX_BODY) return new Response(null, { status: 413 });
        body = JSON.parse(text);
      } catch {
        return new Response(null, { status: 400 });
      }
      const report = sanitize(body);
      if (!report.message) return new Response(null, { status: 400 });
      console.log(JSON.stringify({ kind: 'desktopcam-error', ...report }));
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith('/api/')) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
