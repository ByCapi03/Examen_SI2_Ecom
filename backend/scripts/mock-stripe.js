/**
 * Stripe SIMULADO para pruebas automáticas (NO usar fuera de pruebas).
 * Implementa lo mínimo de la API: crear/leer sesiones de Checkout. Endpoints de control:
 *   POST /_pay/:id          marca la sesión como pagada
 *   POST /_amount/:id/:n    cambia el monto cobrado (simula manipulación)
 *   Puerto: 12111 (MOCK_STRIPE_PORT)
 */
const http = require('http');
const sessions = new Map();
const PORT = +process.env.MOCK_STRIPE_PORT || 12111;
const rid = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const url = req.url.split('?')[0];
    let m;
    if (req.method === 'POST' && url === '/v1/checkout/sessions') {
      const f = Object.fromEntries(new URLSearchParams(body));
      const id = 'cs_test_' + rid();
      const metadata = {};
      for (const [k, v] of Object.entries(f)) { const mm = k.match(/^metadata\[(.+)\]$/); if (mm) metadata[mm[1]] = v; }
      sessions.set(id, {
        id, object: 'checkout.session', mode: f.mode, payment_status: 'unpaid', status: 'open', metadata,
        amount_total: +f['line_items[0][price_data][unit_amount]'] || 0, currency: f['line_items[0][price_data][currency]'],
        url: `https://checkout.stripe.test/c/pay/${id}`,
      });
      return json(200, sessions.get(id));
    }
    if (req.method === 'GET' && (m = url.match(/^\/v1\/checkout\/sessions\/(cs_test_\w+)$/))) {
      const s = sessions.get(m[1]);
      return s ? json(200, s) : json(404, { error: { message: 'No such checkout session', type: 'invalid_request_error' } });
    }
    if (req.method === 'POST' && (m = url.match(/^\/_pay\/(cs_test_\w+)$/))) {
      const s = sessions.get(m[1]); if (!s) return json(404, {});
      s.payment_status = 'paid'; s.status = 'complete'; return json(200, s);
    }
    if (req.method === 'POST' && (m = url.match(/^\/_amount\/(cs_test_\w+)\/(\d+)$/))) {
      const s = sessions.get(m[1]); if (!s) return json(404, {});
      s.amount_total = +m[2]; return json(200, s);
    }
    json(404, { error: { message: 'not found' } });
  });
}).listen(PORT, () => console.log(`Stripe simulado en :${PORT}`));
