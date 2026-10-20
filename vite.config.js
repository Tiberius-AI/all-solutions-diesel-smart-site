import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function calcomServerProxyPlugin(env) {
  const readJsonBody = (req) =>
    new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {})
        } catch (err) {
          reject(err)
        }
      })
      req.on('error', reject)
    })

  const sendJson = (res, status, payload) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
  }

  return {
    name: 'nb-insider-calcom-v2-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/calcom/')) {
          return next()
        }

        const apiKey = (
          process.env.CALCOM_API_KEY ||
          env.CALCOM_API_KEY ||
          ''
        ).trim()

        const parsedUrl = new URL(req.url, 'http://localhost')

        if (parsedUrl.pathname === '/api/calcom/status' && req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            configured: Boolean(apiKey),
            apiVersion: 'v2',
          })
        }

        if (!apiKey) {
          return sendJson(res, 503, {
            ok: false,
            error:
              'Server-side CALCOM_API_KEY is not configured in .env. Using embed/schedule mode.',
          })
        }

        try {
          if (parsedUrl.pathname === '/api/calcom/slots' && req.method === 'GET') {
            const eventTypeId = parsedUrl.searchParams.get('eventTypeId')
            const startTime = parsedUrl.searchParams.get('startTime')
            const endTime = parsedUrl.searchParams.get('endTime')
            const timeZone =
              parsedUrl.searchParams.get('timeZone') || 'America/Chicago'

            if (!eventTypeId || !startTime || !endTime) {
              return sendJson(res, 400, {
                ok: false,
                error: 'Missing eventTypeId, startTime, or endTime query params.',
              })
            }

            const upstreamParams = new URLSearchParams({
              eventTypeId: String(eventTypeId),
              startTime,
              endTime,
              timeZone,
            })

            const upstreamRes = await fetch(
              `https://api.cal.com/v2/slots/available?${upstreamParams.toString()}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'cal-api-version': '2024-09-04',
                },
              }
            )

            const data = await upstreamRes.json().catch(() => ({}))
            if (!upstreamRes.ok) {
              return sendJson(res, upstreamRes.status, {
                ok: false,
                error:
                  data?.error?.message ||
                  data?.message ||
                  `Cal.com v2 slots HTTP ${upstreamRes.status}`,
              })
            }

            return sendJson(res, 200, { ok: true, data })
          }

          if (
            parsedUrl.pathname === '/api/calcom/bookings' &&
            req.method === 'POST'
          ) {
            const body = await readJsonBody(req)
            const upstreamRes = await fetch('https://api.cal.com/v2/bookings', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'cal-api-version': '2024-08-13',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            })

            const data = await upstreamRes.json().catch(() => ({}))
            if (!upstreamRes.ok) {
              return sendJson(res, upstreamRes.status, {
                ok: false,
                error:
                  data?.error?.message ||
                  data?.message ||
                  `Cal.com v2 booking HTTP ${upstreamRes.status}`,
              })
            }

            return sendJson(res, 200, { ok: true, data })
          }

          if (
            parsedUrl.pathname === '/api/calcom/cancel' &&
            req.method === 'POST'
          ) {
            const body = await readJsonBody(req)
            const bookingUid = body?.bookingUid
            if (!bookingUid) {
              return sendJson(res, 400, {
                ok: false,
                error: 'Missing bookingUid to cancel.',
              })
            }

            const upstreamRes = await fetch(
              `https://api.cal.com/v2/bookings/${encodeURIComponent(bookingUid)}/cancel`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'cal-api-version': '2024-08-13',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cancellationReason:
                    body?.cancellationReason ||
                    'Rescheduled or cancelled from GHL Conversation Room',
                }),
              }
            )

            const data = await upstreamRes.json().catch(() => ({}))
            if (!upstreamRes.ok) {
              return sendJson(res, upstreamRes.status, {
                ok: false,
                error:
                  data?.error?.message ||
                  data?.message ||
                  `Cal.com v2 cancel HTTP ${upstreamRes.status}`,
              })
            }

            return sendJson(res, 200, { ok: true, data })
          }

          return sendJson(res, 404, {
            ok: false,
            error: 'Unknown /api/calcom endpoint.',
          })
        } catch (err) {
          return sendJson(res, 502, {
            ok: false,
            error: err?.message || 'Cal.com v2 proxy request failed.',
          })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), calcomServerProxyPlugin(env)],
  }
})
