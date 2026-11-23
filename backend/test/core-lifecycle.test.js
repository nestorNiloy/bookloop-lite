import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import net from 'node:net'

async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error('API process exited before becoming ready.')
    try {
      const response = await fetch(baseUrl + '/api/health')
      if (response.ok) return
    } catch {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('API did not become ready within 15 seconds.')
}

test('BookLoop core transaction lifecycle and exchange integrity', { timeout: 30000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bookloop-lite-test-'))
  const port = await freePort()
  const baseUrl = 'http://127.0.0.1:' + port
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      JWT_SECRET: 'integration-test-secret-at-least-32-characters',
      BOOKLOOP_DB_FILE: path.join(directory, 'test-data.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let logs = ''
  child.stdout.on('data', chunk => { logs += chunk.toString() })
  child.stderr.on('data', chunk => { logs += chunk.toString() })

  t.after(async () => {
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))])
    await rm(directory, { recursive: true, force: true })
  })

  await waitForServer(baseUrl, child)

  async function request(pathname, { method = 'GET', cookie, body } = {}) {
    const response = await fetch(baseUrl + pathname, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await response.json()
    return { status: response.status, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }

  const unauthenticated = await request('/api/books/mine')
  assert.equal(unauthenticated.status, 401)

  const aliceLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'alice@bookloop.dev', password: 'password123' } })
  const benLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'ben@bookloop.dev', password: 'password123' } })
  assert.equal(aliceLogin.status, 200, JSON.stringify(aliceLogin.payload))
  assert.equal(benLogin.status, 200, JSON.stringify(benLogin.payload))
  const aliceCookie = aliceLogin.cookie
  const benCookie = benLogin.cookie
  assert.ok(aliceCookie)
  assert.ok(benCookie)

  const aliceBooksResponse = await request('/api/books/mine', { cookie: aliceCookie })
  const benBooksResponse = await request('/api/books/mine', { cookie: benCookie })
  const cleanCode = aliceBooksResponse.payload.data.find(book => book.title === 'Clean Code')
  const pragProg = aliceBooksResponse.payload.data.find(book => book.title === 'The Pragmatic Programmer')
  const atomicListingResponse = await request('/api/listings?type=EXCHANGE')
  const atomicListing = atomicListingResponse.payload.data.find(item => item.book.title === 'Atomic Habits')
  assert.ok(cleanCode)
  assert.ok(pragProg)
  assert.ok(atomicListing)

  const missingOffer = await request('/api/requests', {
    method: 'POST', cookie: aliceCookie, body: { listingId: atomicListing.id },
  })
  assert.equal(missingOffer.status, 422)

  const foreignOffer = await request('/api/requests', {
    method: 'POST', cookie: aliceCookie,
    body: { listingId: atomicListing.id, offeredBookId: benBooksResponse.payload.data.find(book => book.title === 'Dune').id },
  })
  assert.equal(foreignOffer.status, 403)

  const unlistedOfferResponse = await request('/api/books', {
    method: 'POST', cookie: aliceCookie,
    body: { title: 'Unlisted Offer Book', author: 'Test Author', condition: 'GOOD' },
  })
  assert.equal(unlistedOfferResponse.status, 201)
  const pendingUnlistedOffer = await request('/api/requests', {
    method: 'POST', cookie: aliceCookie,
    body: { listingId: atomicListing.id, offeredBookId: unlistedOfferResponse.payload.data.id },
  })
  assert.equal(pendingUnlistedOffer.status, 201)
  const listingDuringPendingOffer = await request('/api/listings', {
    method: 'POST', cookie: aliceCookie,
    body: { bookId: unlistedOfferResponse.payload.data.id, type: 'BORROW' },
  })
  assert.equal(listingDuringPendingOffer.status, 409)
  assert.equal((await request('/api/requests/' + pendingUnlistedOffer.payload.data.id + '/decline', { method: 'PATCH', cookie: benCookie })).status, 200)

  const firstExchange = await request('/api/requests', {
    method: 'POST', cookie: aliceCookie,
    body: { listingId: atomicListing.id, offeredBookId: cleanCode.id, message: 'Would you like to swap?' },
  })
  assert.equal(firstExchange.status, 201, JSON.stringify(firstExchange.payload))
  assert.equal(firstExchange.payload.data.offeredBook.title, 'Clean Code')

  let catalogue = await request('/api/listings')
  assert.equal(catalogue.payload.data.some(item => item.book.title === 'Atomic Habits'), false)
  assert.equal(catalogue.payload.data.some(item => item.book.title === 'Clean Code'), false)

  const incoming = await request('/api/requests/incoming', { cookie: benCookie })
  assert.equal(incoming.payload.data[0].offeredBook.title, 'Clean Code')

  const declined = await request('/api/requests/' + firstExchange.payload.data.id + '/decline', { method: 'PATCH', cookie: benCookie })
  assert.equal(declined.status, 200)
  catalogue = await request('/api/listings')
  assert.equal(catalogue.payload.data.some(item => item.book.title === 'Atomic Habits'), true)
  assert.equal(catalogue.payload.data.some(item => item.book.title === 'Clean Code'), true)

  const secondExchange = await request('/api/requests', {
    method: 'POST', cookie: aliceCookie,
    body: { listingId: atomicListing.id, offeredBookId: cleanCode.id },
  })
  assert.equal(secondExchange.status, 201)
  const accepted = await request('/api/requests/' + secondExchange.payload.data.id + '/accept', { method: 'PATCH', cookie: benCookie })
  assert.equal(accepted.status, 200)
  const completed = await request('/api/requests/' + secondExchange.payload.data.id + '/complete', { method: 'PATCH', cookie: benCookie })
  assert.equal(completed.status, 200)

  const aliceAfterExchange = await request('/api/books/mine', { cookie: aliceCookie })
  const benAfterExchange = await request('/api/books/mine', { cookie: benCookie })
  assert.ok(aliceAfterExchange.payload.data.some(book => book.id === atomicListing.book.id && book.ownerId === aliceLogin.payload.data.id))
  assert.ok(benAfterExchange.payload.data.some(book => book.id === cleanCode.id && book.ownerId === benLogin.payload.data.id))
  catalogue = await request('/api/listings')
  assert.equal(catalogue.payload.data.some(item => item.book.title === 'Atomic Habits' || item.book.title === 'Clean Code'), false)

  // Borrow completion must release the requested physical book and its listings.
  const borrowListing = (await request('/api/listings?type=BORROW')).payload.data.find(item => item.book.title === 'The Pragmatic Programmer')
  assert.ok(borrowListing)
  const borrowRequest = await request('/api/requests', {
    method: 'POST', cookie: benCookie, body: { listingId: borrowListing.id },
  })
  assert.equal(borrowRequest.status, 201)
  assert.equal((await request('/api/listings')).payload.data.some(item => item.book.title === 'The Pragmatic Programmer'), false)
  assert.equal((await request('/api/requests/' + borrowRequest.payload.data.id + '/accept', { method: 'PATCH', cookie: aliceCookie })).status, 200)
  assert.equal((await request('/api/requests/' + borrowRequest.payload.data.id + '/complete', { method: 'PATCH', cookie: aliceCookie })).status, 200)
  assert.equal((await request('/api/listings')).payload.data.some(item => item.book.title === 'The Pragmatic Programmer'), true)

  const invalidPrice = await request('/api/listings', {
    method: 'POST', cookie: aliceCookie,
    body: { bookId: pragProg.id, type: 'RENT', priceCents: -10, maxDays: 7 },
  })
  assert.equal(invalidPrice.status, 400)

  assert.equal(child.exitCode, null, logs)
});
