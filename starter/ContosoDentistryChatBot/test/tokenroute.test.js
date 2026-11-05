const express = require('express');
const { createTokenRouter } = require('../src/tokenroute');
const { fakeFetch } = require('./helpers');

const SITE = 'https://site.azurestaticapps.net';

async function startServer(options) {
    const app = express();
    app.use(createTokenRouter(options));
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${ server.address().port }`;
    return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

describe('POST /api/token', () => {
    let server;
    afterEach(async () => server && server.close());

    test('exchanges the Direct Line secret for a short-lived token', async () => {
        const directLine = fakeFetch({ conversationId: 'c1', token: 'short-lived', expires_in: 1800 });
        server = await startServer({ secret: 'dl-secret', allowedOrigins: [SITE], fetchImpl: directLine.fetchImpl });

        const response = await fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: SITE } });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ token: 'short-lived', userId: expect.stringMatching(/^dl_/), expiresIn: 1800 });
        expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(directLine.calls[0].url).toBe('https://directline.botframework.com/v3/directline/tokens/generate');
        expect(directLine.calls[0].init.headers.Authorization).toBe('Bearer dl-secret');
        expect(directLine.calls[0].body.user.id).toBe(body.userId);
    });

    test('never echoes the secret back', async () => {
        const directLine = fakeFetch({ token: 't', expires_in: 1 });
        server = await startServer({ secret: 'dl-secret', allowedOrigins: [SITE], fetchImpl: directLine.fetchImpl });

        const text = await (await fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: SITE } })).text();

        expect(text).not.toContain('dl-secret');
    });

    test('refuses origins that are not the website', async () => {
        const directLine = fakeFetch({ token: 't', expires_in: 1 });
        server = await startServer({ secret: 's', allowedOrigins: [SITE], fetchImpl: directLine.fetchImpl });

        const response = await fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: 'https://evil.example' } });

        expect(response.status).toBe(403);
        expect(directLine.calls).toHaveLength(0);
    });

    test('answers the CORS preflight for the website', async () => {
        server = await startServer({ secret: 's', allowedOrigins: [SITE], fetchImpl: fakeFetch({}).fetchImpl });

        const response = await fetch(`${ server.base }/api/token`, { method: 'OPTIONS', headers: { Origin: SITE } });

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-methods')).toBe('POST');
    });

    test('rate-limits each client', async () => {
        const directLine = fakeFetch({ token: 't', expires_in: 1 });
        server = await startServer({ secret: 's', allowedOrigins: [SITE], fetchImpl: directLine.fetchImpl, maxPerMinute: 2 });
        const post = () => fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: SITE } });

        const statuses = [];
        for (let i = 0; i < 3; i++) statuses.push((await post()).status);

        expect(statuses).toEqual([200, 200, 429]);
    });

    test('reports 503 when no secret is configured', async () => {
        server = await startServer({ secret: undefined, allowedOrigins: [SITE], fetchImpl: fakeFetch({}).fetchImpl });

        const response = await fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: SITE } });

        expect(response.status).toBe(503);
    });

    test('reports 502 without details when Direct Line fails', async () => {
        const logger = { error: jest.fn() };
        server = await startServer({ secret: 's', allowedOrigins: [SITE], fetchImpl: fakeFetch({}, { status: 403 }).fetchImpl, logger });

        const response = await fetch(`${ server.base }/api/token`, { method: 'POST', headers: { Origin: SITE } });

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: 'Chat is temporarily unavailable.' });
        expect(logger.error).toHaveBeenCalled();
    });
});
