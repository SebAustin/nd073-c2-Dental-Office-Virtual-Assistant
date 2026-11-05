// POST /api/token swaps the Direct Line secret (held only in app settings) for a short-lived
// token, so the public website never contains a secret (see README, "Website chat security").

const { randomUUID } = require('node:crypto');
const express = require('express');
const { requestJson } = require('./http');

const DIRECT_LINE_TOKEN_URL = 'https://directline.botframework.com/v3/directline/tokens/generate';
const ONE_MINUTE_MS = 60 * 1000;
const DEFAULT_MAX_PER_MINUTE = 10;
const TRACKED_CLIENT_LIMIT = 10000;

/** A fixed-window, per-client request counter. Fine for one App Service instance. */
function createRateLimiter(maxPerMinute, now = Date.now) {
    let windowStart = now();
    let counts = new Map();
    return (clientId) => {
        if (now() - windowStart >= ONE_MINUTE_MS || counts.size > TRACKED_CLIENT_LIMIT) {
            windowStart = now();
            counts = new Map();
        }
        const used = (counts.get(clientId) || 0) + 1;
        counts.set(clientId, used);
        return used <= maxPerMinute;
    };
}

/**
 * @param {{
 *   secret: string | undefined,
 *   allowedOrigins: readonly string[],
 *   fetchImpl?: typeof fetch,
 *   maxPerMinute?: number,
 *   logger?: { error(message: string, error: unknown): void }
 * }} options
 */
function createTokenRouter({ secret, allowedOrigins, fetchImpl = fetch, maxPerMinute = DEFAULT_MAX_PER_MINUTE, logger = console }) {
    const router = express.Router();
    const isAllowed = createRateLimiter(maxPerMinute);

    router.use('/api/token', (req, res, next) => {
        const origin = req.get('Origin');
        if (!origin || !allowedOrigins.includes(origin)) {
            return res.status(403).json({ error: 'Origin not allowed.' });
        }
        res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Cache-Control': 'no-store' });
        return next();
    });

    router.options('/api/token', (req, res) => {
        res.set({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '600' }).sendStatus(204);
    });

    router.post('/api/token', async (req, res) => {
        if (!secret) return res.status(503).json({ error: 'Chat is not configured.' });
        if (!isAllowed(req.ip)) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });

        const userId = `dl_${ randomUUID() }`;
        try {
            const result = await requestJson(fetchImpl, DIRECT_LINE_TOKEN_URL, {
                method: 'POST',
                service: 'Direct Line',
                headers: { Authorization: `Bearer ${ secret }` },
                body: { user: { id: userId } }
            });
            return res.json({ token: result.token, userId, expiresIn: result.expires_in });
        } catch (error) {
            logger.error('[Token] Direct Line token request failed', error);
            return res.status(502).json({ error: 'Chat is temporarily unavailable.' });
        }
    });

    return router;
}

module.exports = { createTokenRouter, createRateLimiter };
