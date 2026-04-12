// tests/helpers.js — shared test utilities for DNS Medic test suite

/**
 * Minimal fetch Response-like object.
 */
function makeResponse(status, body) {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * Returns a fetch mock that dequeues canned responses in order.
 * Entry shape: { status, body }  — or { throws, errorName } to simulate a thrown error.
 */
function makeFetchSequence(...responses) {
  let i = 0;
  return async function mockedFetch(url, _opts) {
    if (i >= responses.length) {
      throw new Error(`Unexpected fetch call #${i + 1} to ${url}`);
    }
    const r = responses[i++];
    if (r.throws !== undefined) {
      const err = new Error(r.throws);
      if (r.errorName) err.name = r.errorName;
      throw err;
    }
    return makeResponse(r.status ?? 200, r.body ?? {});
  };
}

/**
 * Mock chrome.storage.local / .sync implementation.
 * Exposes _raw for direct inspection in tests.
 */
function makeMockStorage(initial = {}) {
  const _raw = Object.assign({}, initial);
  const storage = {
    // Getter always returns the internal _raw object so closures and external
    // code all share the same reference. Setter clears _raw in-place and merges
    // the new value — this keeps the closure binding stable after `storage._raw = {}`.
    get _raw() { return _raw; },
    set _raw(val) {
      for (const k of Object.keys(_raw)) delete _raw[k];
      if (val && typeof val === "object") Object.assign(_raw, val);
    },
    get: async (key) => {
      if (typeof key === "string") return { [key]: _raw[key] };
      const result = {};
      for (const k of Array.isArray(key) ? key : [key]) result[k] = _raw[k];
      return result;
    },
    set: async (obj) => { Object.assign(_raw, obj); },
    remove: async (key) => {
      for (const k of Array.isArray(key) ? key : [key]) delete _raw[k];
    },
  };
  return storage;
}

module.exports = { makeResponse, makeFetchSequence, makeMockStorage };
