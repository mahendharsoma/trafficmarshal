/**
 * API utility function for making HTTP requests
 * @param {string} path - API endpoint path
 * @param {Object} opts - Request options (method, body, headers)
 * @returns {Promise<Object>} Response data
 */
export async function api(path, opts = {}) {
  const apiPath = path.startsWith('/api') ? path : `/api${path}`
  const body = typeof opts.body === 'string' ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  const res = await fetch(apiPath, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body,
  })

  // Read raw text first
  const text = await res.text()

  // Handle empty response
  if (!text) {
    return res.ok ? null : { error: `Request failed (${res.status})` }
  }

  try {
    const data = JSON.parse(text)
    if (!res.ok && !data?.error) return { ...data, error: `Request failed (${res.status})` }
    return data
  } catch (err) {
    console.error('Invalid JSON response:', { path: apiPath, status: res.status, text })
    throw new Error(`Server returned invalid JSON for ${apiPath}`)
  }
}
