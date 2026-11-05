/**
 * A fake `fetch` that records calls and answers with the given JSON body.
 * @param {unknown} body
 * @param {{ status?: number }} [options]
 */
function fakeFetch(body, { status = 200, rawText } = {}) {
    const calls = [];
    const text = rawText !== undefined ? rawText : JSON.stringify(body);
    const fetchImpl = async (url, init) => {
        calls.push({ url: String(url), init, body: init && init.body ? JSON.parse(init.body) : undefined });
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text),
            text: async () => text
        };
    };
    return { fetchImpl, calls };
}

module.exports = { fakeFetch };
