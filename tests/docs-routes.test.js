import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'

async function startServer() {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  }
}

test('GET /docs/openapi.json returns the OpenAPI document', async (t) => {
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/docs/openapi.json`)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.openapi, '3.0.3')
  assert.ok(payload.paths['/auth/register'])
})

test('GET /docs/openapi.yaml returns the OpenAPI yaml document', async (t) => {
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/docs/openapi.yaml`)
  const yaml = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /yaml|text\/plain/)
  assert.match(yaml, /openapi: 3\.0\.3/)
  assert.match(yaml, /\/auth\/register:/)
})

test('GET /docs returns the API documentation page', async (t) => {
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/docs`)
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/html/)
  assert.match(html, /openapi\.json/)
  assert.match(html, /account-app-sever API/)
})
