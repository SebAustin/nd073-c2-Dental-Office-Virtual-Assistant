const REQUEST_TIMEOUT_MS = 8000;

/**
 * Joins a base URL and a path without doubling or dropping the slash.
 * @param {string} base
 * @param {string} path
 */
function joinUrl(base, path) {
    return `${ base.replace(/\/+$/, '') }/${ path.replace(/^\/+/, '') }`;
}

/**
 * Sends a request and parses the JSON reply, failing loudly on non-2xx answers.
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown, service: string }} options
 * @returns {Promise<unknown>}
 */
async function requestJson(fetchImpl, url, { method = 'GET', headers = {}, body, service }) {
    const init = {
        method,
        headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    };
    const response = await fetchImpl(url, init);
    if (!response.ok) {
        throw new Error(`${ service } request failed with HTTP ${ response.status }`);
    }
    return response.json();
}

module.exports = { joinUrl, requestJson };
