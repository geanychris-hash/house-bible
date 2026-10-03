// Transport to the Apps Script web app (CONTRACT section 4). One POST, text/plain JSON body
// (no CORS preflight). The shared key is sent in the body and is never logged or put in a URL.
export class ApiError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export function createApi({ getConfig, fetchImpl }) {
  return async function call(action, extra = {}, configOverride = null) {
    const cfg = configOverride || getConfig();
    if (!cfg || !cfg.url || !cfg.key) throw new ApiError('not_configured', 'Not connected yet');
    const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
    let res;
    try {
      res = await doFetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ key: cfg.key, action, device: cfg.device || 'unknown', ...extra }),
        redirect: 'follow',
      });
    } catch {
      throw new ApiError('network', 'Cannot reach the server');
    }
    let json;
    try { json = await res.json(); } catch { throw new ApiError('bad_response', 'Server sent something unreadable (is the URL the /exec link?)'); }
    if (!json || json.ok !== true) throw new ApiError((json && json.error) || 'server', (json && json.message) || 'Server error');
    return json;
  };
}
