import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { db, initDb } from './db.js'

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'bookloop-lite-dev-secret-change-in-production'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// ── Helpers ────────────────────────────────────────────────────

function ok(data)               { return { success: true, data, error: null } }
function fail(code, message)    { return { success: false, data: null, error: { code, message } } }

function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
}

function publicUser(user) {
  const { passwordHash, ...rest } = user
  return rest
}

function publicBook(book) {
  const owner = db.data.users.find(u => u.id === book.ownerId)
  return { ...book, ownerName: owner?.name ?? 'Unknown' }
}

function publicListing(listing) {
  const book = db.data.books.find(b => b.id === listing.bookId)
  return { ...listing, book: book ? publicBook(book) : null }
}

// Auth middleware — reads JWT from HTTP-only cookie
function requireAuth(req, res, next) {
  const token = req.cookies.bookloop_token
  if (!token) return res.status(401).json(fail('UNAUTHORIZED', 'Please log in.'))

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json(fail('UNAUTHORIZED', 'Session expired. Please log in again.'))
  }
}

function setAuthCookie(res, token) {
  res.cookie('bookloop_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

// ── Auth routes ──────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body

  if (!name || name.length < 2) return res.status(400).json(fail('VALIDATION_ERROR', 'Name must be at least 2 characters.'))
  if (!email || !email.includes('@')) return res.status(400).json(fail('VALIDATION_ERROR', 'A valid email is required.'))
  if (!password || password.length < 8) return res.status(400).json(fail('VALIDATION_ERROR', 'Password must be at least 8 characters.'))

  await db.read()
  if (db.data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'An account with this email already exists.'))
  }

  const user = {
    id: nanoid(),
    name,
    email: email.toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: Date.now(),
  }
  db.data.users.push(user)
  await db.write()

  setAuthCookie(res, signToken(user))
  res.status(201).json(ok(publicUser(user)))
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  await db.read()

  const user = db.data.users.find(u => u.email.toLowerCase() === (email ?? '').toLowerCase())
  if (!user || !bcrypt.compareSync(password ?? '', user.passwordHash)) {
    return res.status(401).json(fail('INVALID_CREDENTIALS', 'Email or password is incorrect.'))
  }

  setAuthCookie(res, signToken(user))
  res.json(ok(publicUser(user)))
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('bookloop_token')
  res.json(ok(null))
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.userId)
  if (!user) return res.status(401).json(fail('UNAUTHORIZED', 'Session invalid.'))
  res.json(ok(publicUser(user)))
})

// ── Book routes ──────────────────────────────────────────────────

app.get('/api/books/mine', requireAuth, async (req, res) => {
  await db.read()
  const books = db.data.books.filter(b => b.ownerId === req.userId).map(publicBook)
  res.json(ok(books))
})

app.post('/api/books', requireAuth, async (req, res) => {
  const { title, author, genre, condition, description } = req.body
  if (!title || !author) return res.status(400).json(fail('VALIDATION_ERROR', 'Title and author are required.'))

  await db.read()
  const book = {
    id: nanoid(),
    ownerId: req.userId,
    title, author,
    genre: genre || null,
    condition: condition || 'GOOD',
    description: description || null,
    createdAt: Date.now(),
  }
  db.data.books.push(book)
  await db.write()
  res.status(201).json(ok(publicBook(book)))
})

app.delete('/api/books/:id', requireAuth, async (req, res) => {
  await db.read()
  const book = db.data.books.find(b => b.id === req.params.id)
  if (!book) return res.status(404).json(fail('NOT_FOUND', 'Book not found.'))
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You do not own this book.'))

  const hasActiveListing = db.data.listings.some(l =>
    l.bookId === book.id && (l.status === 'RESERVED' || l.status === 'ACTIVE'))
  if (hasActiveListing) {
    return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'Cannot delete a book with an active listing.'))
  }

  db.data.books = db.data.books.filter(b => b.id !== book.id)
  db.data.listings = db.data.listings.filter(l => l.bookId !== book.id)
  await db.write()
  res.json(ok(null))
})

// ── Listing routes ───────────────────────────────────────────────

app.get('/api/listings', async (req, res) => {
  await db.read()
  const { type, genre, q } = req.query

  let results = db.data.listings.filter(l => l.status === 'AVAILABLE')
  results = results.map(publicListing)

  if (type)  results = results.filter(l => l.type === type)
  if (genre) results = results.filter(l => l.book?.genre === genre)
  if (q) {
    const needle = q.toLowerCase()
    results = results.filter(l =>
      l.book?.title.toLowerCase().includes(needle) ||
      l.book?.author.toLowerCase().includes(needle))
  }

  results.sort((a, b) => b.createdAt - a.createdAt)
  res.json(ok(results))
})

app.get('/api/listings/mine', requireAuth, async (req, res) => {
  await db.read()
  const myBookIds = db.data.books.filter(b => b.ownerId === req.userId).map(b => b.id)
  const listings = db.data.listings.filter(l => myBookIds.includes(l.bookId)).map(publicListing)
  res.json(ok(listings))
})

app.post('/api/listings', requireAuth, async (req, res) => {
  const { bookId, type, priceCents, maxDays } = req.body

  await db.read()
  const book = db.data.books.find(b => b.id === bookId)
  if (!book) return res.status(404).json(fail('NOT_FOUND', 'Book not found.'))
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You can only list your own books.'))

  // Type-specific validation — same rule as the enterprise version
  if ((type === 'RENT' || type === 'SALE') && !priceCents) {
    return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', `${type} listings require a price.`))
  }
  if ((type === 'BORROW' || type === 'EXCHANGE') && priceCents) {
    return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', `${type} listings cannot have a price.`))
  }
  if (type === 'RENT' && !maxDays) {
    return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'Rent listings require a max rental duration.'))
  }

  const existing = db.data.listings.find(l => l.bookId === bookId && l.type === type && l.status !== 'UNLISTED')
  if (existing) return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', `This book already has an active ${type} listing.`))

  const listing = {
    id: nanoid(), bookId, type,
    status: 'AVAILABLE',
    priceCents: priceCents || null,
    maxDays: maxDays || null,
    createdAt: Date.now(),
  }
  db.data.listings.push(listing)
  await db.write()
  res.status(201).json(ok(publicListing(listing)))
})

app.delete('/api/listings/:id', requireAuth, async (req, res) => {
  await db.read()
  const listing = db.data.listings.find(l => l.id === req.params.id)
  if (!listing) return res.status(404).json(fail('NOT_FOUND', 'Listing not found.'))

  const book = db.data.books.find(b => b.id === listing.bookId)
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You do not own this listing.'))
  if (listing.status !== 'AVAILABLE') return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'Cannot remove a listing that is reserved or active.'))

  db.data.listings = db.data.listings.filter(l => l.id !== listing.id)
  await db.write()
  res.json(ok(null))
})

// ── Request routes (simplified transaction lifecycle) ─────────────
// Lifecycle: REQUESTED -> ACCEPTED -> COMPLETED
//                      \-> DECLINED

app.get('/api/requests/incoming', requireAuth, async (req, res) => {
  await db.read()
  const myBookIds = db.data.books.filter(b => b.ownerId === req.userId).map(b => b.id)
  const requests = db.data.requests
    .filter(r => myBookIds.includes(db.data.listings.find(l => l.id === r.listingId)?.bookId))
    .map(enrichRequest)
    .sort((a, b) => b.createdAt - a.createdAt)
  res.json(ok(requests))
})

app.get('/api/requests/outgoing', requireAuth, async (req, res) => {
  await db.read()
  const requests = db.data.requests
    .filter(r => r.requesterId === req.userId)
    .map(enrichRequest)
    .sort((a, b) => b.createdAt - a.createdAt)
  res.json(ok(requests))
})

function enrichRequest(r) {
  const listing = db.data.listings.find(l => l.id === r.listingId)
  const requester = db.data.users.find(u => u.id === r.requesterId)
  const owner = listing ? db.data.users.find(u => u.id === db.data.books.find(b => b.id === listing.bookId)?.ownerId) : null

  return {
    ...r,
    listing: listing ? publicListing(listing) : null,
    requesterName: requester?.name,
    ownerName: owner?.name,
    // Contact reveal — ONLY after ACCEPTED. This mirrors the
    // TRANSACTION_PARTNERS visibility rule from the enterprise version:
    // contact info is only shared once both parties have a confirmed transaction.
    requesterEmail: r.status === 'ACCEPTED' || r.status === 'COMPLETED' ? requester?.email : null,
    ownerEmail:     r.status === 'ACCEPTED' || r.status === 'COMPLETED' ? owner?.email     : null,
  }
}

app.post('/api/requests', requireAuth, async (req, res) => {
  const { listingId, message } = req.body
  await db.read()

  const listing = db.data.listings.find(l => l.id === listingId)
  if (!listing) return res.status(404).json(fail('NOT_FOUND', 'Listing not found.'))
  if (listing.status !== 'AVAILABLE') return res.status(409).json(fail('CONFLICT', 'This listing is no longer available.'))

  const book = db.data.books.find(b => b.id === listing.bookId)
  if (book.ownerId === req.userId) return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'You cannot request your own listing.'))

  // Simple concurrency guard — check-then-set. Good enough for a JSON file store;
  // the enterprise version uses real optimistic locking (@Version) for this.
  listing.status = 'RESERVED'

  const request = {
    id: nanoid(),
    listingId,
    requesterId: req.userId,
    status: 'REQUESTED',
    message: message || null,
    createdAt: Date.now(),
  }
  db.data.requests.push(request)
  await db.write()

  res.status(201).json(ok(enrichRequest(request)))
})

app.patch('/api/requests/:id/accept', requireAuth, async (req, res) => {
  await db.read()
  const request = db.data.requests.find(r => r.id === req.params.id)
  if (!request) return res.status(404).json(fail('NOT_FOUND', 'Request not found.'))

  const listing = db.data.listings.find(l => l.id === request.listingId)
  const book = db.data.books.find(b => b.id === listing.bookId)
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'Only the owner can accept this request.'))
  if (request.status !== 'REQUESTED') return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'This request has already been handled.'))

  request.status = 'ACCEPTED'
  listing.status = 'ACTIVE'
  await db.write()
  res.json(ok(enrichRequest(request)))
})

app.patch('/api/requests/:id/decline', requireAuth, async (req, res) => {
  await db.read()
  const request = db.data.requests.find(r => r.id === req.params.id)
  if (!request) return res.status(404).json(fail('NOT_FOUND', 'Request not found.'))

  const listing = db.data.listings.find(l => l.id === request.listingId)
  const book = db.data.books.find(b => b.id === listing.bookId)
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'Only the owner can decline this request.'))
  if (request.status !== 'REQUESTED') return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'This request has already been handled.'))

  request.status = 'DECLINED'
  listing.status = 'AVAILABLE'
  await db.write()
  res.json(ok(enrichRequest(request)))
})

app.patch('/api/requests/:id/complete', requireAuth, async (req, res) => {
  await db.read()
  const request = db.data.requests.find(r => r.id === req.params.id)
  if (!request) return res.status(404).json(fail('NOT_FOUND', 'Request not found.'))

  const listing = db.data.listings.find(l => l.id === request.listingId)
  const book = db.data.books.find(b => b.id === listing.bookId)

  const isParticipant = book.ownerId === req.userId || request.requesterId === req.userId
  if (!isParticipant) return res.status(403).json(fail('FORBIDDEN', 'You are not part of this transaction.'))
  if (request.status !== 'ACCEPTED') return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'Only an accepted request can be completed.'))

  request.status = 'COMPLETED'
  // SALE and EXCHANGE remove the listing permanently; BORROW/RENT free it up again
  listing.status = (listing.type === 'SALE' || listing.type === 'EXCHANGE') ? 'UNLISTED' : 'AVAILABLE'
  await db.write()
  res.json(ok(enrichRequest(request)))
})

// ── Boot ─────────────────────────────────────────────────────────

initDb().then(() => {
  app.listen(PORT, () => console.log(`BookLoop Lite API running on http://localhost:${PORT}`))
})
