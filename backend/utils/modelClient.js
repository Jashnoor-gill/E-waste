// Lightweight wrapper to call an external model service with a fetch fallback
export async function callModelService(url, payload = {}, timeoutMs = 15000) {
  // pick fetch: prefer global fetch (Node 18+), otherwise dynamic import node-fetch
  let fetchFn;
  if (typeof fetch !== 'undefined') {
    fetchFn = fetch;
  } else {
    // dynamic import so node-fetch is only required on older Node versions
    const mod = await import('node-fetch');
    fetchFn = mod.default;
  }

  // Abort controller for timeout (works with node-fetch and native fetch)
  let controller;
  let signal = undefined;
  try {
    const AbortController = globalThis.AbortController || (await import('abort-controller')).default;
    controller = new AbortController();
    signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Model service returned ${res.status}: ${text}`);
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  } catch (err) {
    // normalize AbortError message
    if (err.name === 'AbortError') throw new Error('Model service request timed out');
    throw err;
  }
}

// Retry wrapper: retries `attempts` times with exponential backoff (ms)
export async function callModelServiceWithRetries(url, payload = {}, opts = {}) {
  const attempts = opts.attempts || 3;
  const baseDelay = opts.baseDelay || 500; // ms
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await callModelService(url, payload, opts.timeoutMs || 15000);
      return res;
    } catch (err) {
      lastErr = err;
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Model service attempt ${i + 1} failed: ${err}. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
