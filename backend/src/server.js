import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { randomBytes } from 'node:crypto'
import { db, initDb } from './db.js'

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 4000
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER)
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not configured. Sessions will be invalidated when this process restarts.')

const allowedOrigins = new Set(['https://bookloop-lite.vercel.app', 'http://localhost:5173'])
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// lowdb uses one JSON file; serialize requests to prevent read-modify-write races.
let requestQueue = Promise.resolve()
app.use((req, res, next) => {
  const execute = () => new Promise(resolve => {
    let finished = false
    const done = () => { if (!finished) { finished = true; resolve() } }
    res.once('finish', done)
    res.once('close', done)
    next()
  })
  requestQueue = requestQueue.then(execute, execute)
})

const TYPES = new Set(['BORROW', 'RENT', 'SALE', 'EXCHANGE'])
const CONDITIONS = new Set(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'WORN'])
const ACTIVE_STATUSES = new Set(['RESERVED', 'ACTIVE'])
const ok = data => ({ success: true, data, error: null })
const fail = (code, message) => ({ success: false, data: null, error: { code, message } })
const route = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''

function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
}
function publicUser(user) {
  const { passwordHash, ...safe } = user
  return safe
}
function publicBook(book) {
  const owner = db.data.users.find(user => user.id === book.ownerId)
  return { ...book, ownerName: owner?.name ?? 'Unknown' }
}
function publicListing(listing) {
  const book = db.data.books.find(item => item.id === listing.bookId)
  return { ...listing, book: book ? publicBook(book) : null }
}
function requireAuth(req, res, next) {
  const token = req.cookies.bookloop_token
  if (!token) return res.status(401).json(fail('UNAUTHORIZED', 'Please log in.'))
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub
    return next()
  } catch {
    return res.status(401).json(fail('UNAUTHORIZED', 'Session expired. Please log in again.'))
  }
}
function setAuthCookie(res, token) {
  res.cookie('bookloop_token', token, {
    httpOnly: true, sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}
function listingsForBook(bookId) {
  return db.data.listings.filter(listing => listing.bookId === bookId)
}
function isBookLocked(bookId) {
  return listingsForBook(bookId).some(listing => ACTIVE_STATUSES.has(listing.status))
}
function restoreLockedListings(request) {
  for (const listingId of request.lockedListingIds ?? [request.listingId]) {
    const listing = db.data.listings.find(item => item.id === listingId)
    if (listing && ACTIVE_STATUSES.has(listing.status)) listing.status = 'AVAILABLE'
  }
}
function enrichRequest(request) {
  const listing = db.data.listings.find(item => item.id === request.listingId)
  const requester = db.data.users.find(user => user.id === request.requesterId)
  const owner = db.data.users.find(user => user.id === request.ownerId)
  const offeredBook = request.offeredBookId ? db.data.books.find(book => book.id === request.offeredBookId) : null
  const revealContact = request.status === 'ACCEPTED' || request.status === 'COMPLETED'
  return {
    ...request,
    listing: listing ? publicListing(listing) : null,
    offeredBook: offeredBook ? publicBook(offeredBook) : null,
    requesterName: requester?.name ?? 'Former member',
    ownerName: owner?.name ?? 'Former member',
    requesterEmail: revealContact ? requester?.email ?? null : null,
    ownerEmail: revealContact ? owner?.email ?? null : null,
  }
}

app.get('/api/health', (req, res) => res.json(ok({ status: 'UP' })))

// Authentication
app.post('/api/auth/register', route(async (req, res) => {
  const name = clean(req.body?.name, 80)
  const email = clean(req.body?.email, 254).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (name.length < 2) return res.status(400).json(fail('VALIDATION_ERROR', 'Name must be at least 2 characters.'))
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json(fail('VALIDATION_ERROR', 'A valid email is required.'))
  if (password.length < 8 || password.length > 128) return res.status(400).json(fail('VALIDATION_ERROR', 'Password must be between 8 and 128 characters.'))
  await db.read()
  if (db.data.users.some(user => user.email.toLowerCase() === email)) return res.status(409).json(fail('EMAIL_EXISTS', 'An account with this email already exists.'))
  const user = { id: nanoid(), name, email, passwordHash: await bcrypt.hash(password, 10), createdAt: Date.now() }
  db.data.users.push(user)
  await db.write()
  setAuthCookie(res, signToken(user))
  return res.status(201).json(ok(publicUser(user)))
}))

app.post('/api/auth/login', route(async (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  await db.read()
  const user = db.data.users.find(item => item.email.toLowerCase() === email)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json(fail('INVALID_CREDENTIALS', 'Email or password is incorrect.'))
  setAuthCookie(res, signToken(user))
  return res.json(ok(publicUser(user)))
}))
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('bookloop_token', { httpOnly: true, sameSite: isProduction ? 'none' : 'lax', secure: isProduction })
  return res.json(ok(null))
})
app.get('/api/auth/me', requireAuth, route(async (req, res) => {
  await db.read()
  const user = db.data.users.find(item => item.id === req.userId)
  if (!user) return res.status(401).json(fail('UNAUTHORIZED', 'Session is no longer valid.'))
  return res.json(ok(publicUser(user)))
}))

// Personal bookshelf
app.get('/api/books/mine', requireAuth, route(async (req, res) => {
  await db.read()
  return res.json(ok(db.data.books.filter(book => book.ownerId === req.userId).map(publicBook)))
}))
app.post('/api/books', requireAuth, route(async (req, res) => {
  const title = clean(req.body?.title, 160)
  const author = clean(req.body?.author, 120)
  const genre = clean(req.body?.genre, 60)
  const description = clean(req.body?.description, 1000)
  const condition = req.body?.condition || 'GOOD'
  if (!title || !author) return res.status(400).json(fail('VALIDATION_ERROR', 'Title and author are required.'))
  if (!CONDITIONS.has(condition)) return res.status(400).json(fail('VALIDATION_ERROR', 'Choose a valid book condition.'))
  await db.read()
  const book = { id: nanoid(), ownerId: req.userId, title, author, genre: genre || null, condition, description: description || null, createdAt: Date.now() }
  db.data.books.push(book)
  await db.write()
  return res.status(201).json(ok(publicBook(book)))
}))
app.delete('/api/books/:id', requireAuth, route(async (req, res) => {
  await db.read()
  const book = db.data.books.find(item => item.id === req.params.id)
  if (!book) return res.status(404).json(fail('NOT_FOUND', 'Book not found.'))
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You do not own this book.'))
  if (isBookLocked(book.id)) return res.status(409).json(fail('BOOK_IN_TRANSACTION', 'This book is reserved or part of an active transaction.'))
  db.data.books = db.data.books.filter(item => item.id !== book.id)
  db.data.listings = db.data.listings.filter(item => item.bookId !== book.id)
  await db.write()
  return res.json(ok(null))
}))

// Marketplace listings
app.get('/api/listings', route(async (req, res) => {
  await db.read()
  const type = clean(req.query.type, 20).toUpperCase()
  const genre = clean(req.query.genre, 60)
  const query = clean(req.query.q, 100).toLowerCase()
  if (type && !TYPES.has(type)) return res.status(400).json(fail('VALIDATION_ERROR', 'Unknown listing type.'))
  let results = db.data.listings.filter(item => item.status === 'AVAILABLE').map(publicListing).filter(item => item.book)
  if (type) results = results.filter(item => item.type === type)
  if (genre) results = results.filter(item => item.book.genre === genre)
  if (query) results = results.filter(item => item.book.title.toLowerCase().includes(query) || item.book.author.toLowerCase().includes(query))
  results.sort((a, b) => b.createdAt - a.createdAt)
  return res.json(ok(results))
}))
app.get('/api/listings/mine', requireAuth, route(async (req, res) => {
  await db.read()
  const ownedBookIds = new Set(db.data.books.filter(book => book.ownerId === req.userId).map(book => book.id))
  return res.json(ok(db.data.listings.filter(item => ownedBookIds.has(item.bookId)).map(publicListing)))
}))
app.post('/api/listings', requireAuth, route(async (req, res) => {
  const bookId = clean(req.body?.bookId, 100)
  const type = clean(req.body?.type, 20).toUpperCase()
  const priceCents = req.body?.priceCents
  const maxDays = req.body?.maxDays
  if (!TYPES.has(type)) return res.status(400).json(fail('VALIDATION_ERROR', 'Choose a valid listing type.'))
  if (type === 'RENT' || type === 'SALE') {
    if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 100000000) return res.status(400).json(fail('VALIDATION_ERROR', 'Enter a valid positive price.'))
  } else if (priceCents !== undefined && priceCents !== null && priceCents !== 0) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Borrow and exchange listings cannot have a price.'))
  }
  if (type === 'RENT' && (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 365)) return res.status(400).json(fail('VALIDATION_ERROR', 'Rental duration must be between 1 and 365 days.'))
  await db.read()
  const book = db.data.books.find(item => item.id === bookId)
  if (!book) return res.status(404).json(fail('NOT_FOUND', 'Book not found.'))
  if (book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You can only list your own books.'))
  if (isBookLocked(book.id)) return res.status(409).json(fail('BOOK_IN_TRANSACTION', 'This book is already reserved or in an active transaction.'))
  const existing = db.data.listings.find(item => item.bookId === bookId && item.type === type && item.status !== 'UNLISTED')
  if (existing) return res.status(409).json(fail('LISTING_EXISTS', 'This book already has a listing of that type.'))
  const listing = { id: nanoid(), bookId, type, status: 'AVAILABLE', priceCents: type === 'RENT' || type === 'SALE' ? priceCents : null, maxDays: type === 'RENT' ? maxDays : null, createdAt: Date.now() }
  db.data.listings.push(listing)
  await db.write()
  return res.status(201).json(ok(publicListing(listing)))
}))
app.delete('/api/listings/:id', requireAuth, route(async (req, res) => {
  await db.read()
  const listing = db.data.listings.find(item => item.id === req.params.id)
  if (!listing) return res.status(404).json(fail('NOT_FOUND', 'Listing not found.'))
  const book = db.data.books.find(item => item.id === listing.bookId)
  if (!book || book.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'You do not own this listing.'))
  if (listing.status !== 'AVAILABLE') return res.status(409).json(fail('LISTING_LOCKED', 'Only available listings can be removed.'))
  db.data.listings = db.data.listings.filter(item => item.id !== listing.id)
  await db.write()
  return res.json(ok(null))
}))

// Request and transaction lifecycle
app.get('/api/requests/incoming', requireAuth, route(async (req, res) => {
  await db.read()
  const requests = db.data.requests.filter(item => item.ownerId === req.userId).map(enrichRequest).sort((a, b) => b.createdAt - a.createdAt)
  return res.json(ok(requests))
}))
app.get('/api/requests/outgoing', requireAuth, route(async (req, res) => {
  await db.read()
  const requests = db.data.requests.filter(item => item.requesterId === req.userId).map(enrichRequest).sort((a, b) => b.createdAt - a.createdAt)
  return res.json(ok(requests))
}))
app.post('/api/requests', requireAuth, route(async (req, res) => {
  const listingId = clean(req.body?.listingId, 100)
  const message = clean(req.body?.message, 500)
  const offeredBookId = clean(req.body?.offeredBookId, 100)
  await db.read()
  const listing = db.data.listings.find(item => item.id === listingId)
  if (!listing) return res.status(404).json(fail('NOT_FOUND', 'Listing not found.'))
  if (listing.status !== 'AVAILABLE') return res.status(409).json(fail('CONFLICT', 'This listing is no longer available.'))
  const targetBook = db.data.books.find(item => item.id === listing.bookId)
  if (!targetBook) return res.status(404).json(fail('NOT_FOUND', 'Book not found.'))
  if (targetBook.ownerId === req.userId) return res.status(422).json(fail('BUSINESS_RULE_VIOLATION', 'You cannot request your own listing.'))
  if (isBookLocked(targetBook.id)) return res.status(409).json(fail('BOOK_IN_TRANSACTION', 'This book is already part of another transaction.'))

  let offeredBook = null
  if (listing.type === 'EXCHANGE') {
    if (!offeredBookId) return res.status(422).json(fail('OFFER_REQUIRED', 'Choose one of your books to offer in exchange.'))
    offeredBook = db.data.books.find(item => item.id === offeredBookId)
    if (!offeredBook) return res.status(404).json(fail('OFFER_NOT_FOUND', 'The offered book could not be found.'))
    if (offeredBook.ownerId !== req.userId) return res.status(403).json(fail('OFFER_NOT_OWNED', 'You can only offer a book from your own shelf.'))
    if (offeredBook.id === targetBook.id) return res.status(422).json(fail('INVALID_EXCHANGE', 'You cannot exchange a book for itself.'))
    if (isBookLocked(offeredBook.id)) return res.status(409).json(fail('OFFER_LOCKED', 'Your offered book is already reserved or in an active transaction.'))
  } else if (offeredBookId) {
    return res.status(400).json(fail('UNEXPECTED_OFFER', 'An offered book is only valid for an exchange listing.'))
  }

  const lockedListingIds = [...new Set([
    ...listingsForBook(targetBook.id).filter(item => item.status === 'AVAILABLE').map(item => item.id),
    ...(offeredBook ? listingsForBook(offeredBook.id).filter(item => item.status === 'AVAILABLE').map(item => item.id) : []),
  ])]
  for (const id of lockedListingIds) {
    const item = db.data.listings.find(candidate => candidate.id === id)
    if (item) item.status = 'RESERVED'
  }
  const request = {
    id: nanoid(), listingId, requesterId: req.userId, ownerId: targetBook.ownerId,
    offeredBookId: offeredBook?.id ?? null, lockedListingIds,
    status: 'REQUESTED', message: message || null, createdAt: Date.now(),
  }
  db.data.requests.push(request)
  await db.write()
  return res.status(201).json(ok(enrichRequest(request)))
}))

async function handleRequestDecision(req, res, decision) {
  await db.read()
  const request = db.data.requests.find(item => item.id === req.params.id)
  if (!request) return res.status(404).json(fail('NOT_FOUND', 'Request not found.'))
  if (request.ownerId !== req.userId) return res.status(403).json(fail('FORBIDDEN', 'Only the listing owner can handle this request.'))
  if (request.status !== 'REQUESTED') return res.status(409).json(fail('REQUEST_ALREADY_HANDLED', 'This request has already been handled.'))
  const listing = db.data.listings.find(item => item.id === request.listingId)
  const book = listing && db.data.books.find(item => item.id === listing.bookId)
  if (!listing || !book || book.ownerId !== request.ownerId) return res.status(409).json(fail('OWNERSHIP_CHANGED', 'The book ownership changed before this request could be handled.'))
  if (decision === 'accept') {
    request.status = 'ACCEPTED'
    listing.status = 'ACTIVE'
  } else {
    request.status = 'DECLINED'
    restoreLockedListings(request)
  }
  request.updatedAt = Date.now()
  await db.write()
  return res.json(ok(enrichRequest(request)))
}
app.patch('/api/requests/:id/accept', requireAuth, route((req, res) => handleRequestDecision(req, res, 'accept')))
app.patch('/api/requests/:id/decline', requireAuth, route((req, res) => handleRequestDecision(req, res, 'decline')))

app.patch('/api/requests/:id/complete', requireAuth, route(async (req, res) => {
  await db.read()
  const request = db.data.requests.find(item => item.id === req.params.id)
  if (!request) return res.status(404).json(fail('NOT_FOUND', 'Request not found.'))
  if (request.status !== 'ACCEPTED') return res.status(409).json(fail('REQUEST_NOT_ACCEPTED', 'Only an accepted request can be completed.'))
  const listing = db.data.listings.find(item => item.id === request.listingId)
  const targetBook = listing && db.data.books.find(item => item.id === listing.bookId)
  if (!listing || !targetBook) return res.status(409).json(fail('BOOK_NOT_FOUND', 'The transaction book no longer exists.'))
  if (req.userId !== request.ownerId && req.userId !== request.requesterId) return res.status(403).json(fail('FORBIDDEN', 'You are not part of this transaction.'))
  if (targetBook.ownerId !== request.ownerId) return res.status(409).json(fail('OWNERSHIP_CHANGED', 'The book owner changed before completion.'))

  if (listing.type === 'EXCHANGE' || listing.type === 'SALE') {
    if (!db.data.users.some(user => user.id === request.requesterId)) return res.status(409).json(fail('USER_NOT_FOUND', 'The requesting member no longer exists.'))
    if (listing.type === 'EXCHANGE') {
      const offeredBook = db.data.books.find(item => item.id === request.offeredBookId)
      if (!offeredBook || offeredBook.ownerId !== request.requesterId) return res.status(409).json(fail('OFFER_OWNERSHIP_CHANGED', 'The offered book is no longer owned by the requester.'))
      offeredBook.ownerId = request.ownerId
      offeredBook.updatedAt = Date.now()
    }
    targetBook.ownerId = request.requesterId
    targetBook.updatedAt = Date.now()
    const transferredIds = new Set([targetBook.id, ...(request.offeredBookId ? [request.offeredBookId] : [])])
    for (const item of db.data.listings) if (transferredIds.has(item.bookId)) item.status = 'UNLISTED'
  } else {
    restoreLockedListings(request)
  }
  request.status = 'COMPLETED'
  request.completedAt = Date.now()
  await db.write()
  return res.json(ok(enrichRequest(request)))
}))

app.use((err, req, res, next) => {
  console.error('BookLoop API error:', err)
  if (res.headersSent) return next(err)
  const status = err.message === 'Origin is not allowed by CORS.' ? 403 : 500
  return res.status(status).json(fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
    status === 403 ? 'This website is not allowed to access BookLoop.' : 'An unexpected server error occurred.'))
})

initDb().then(() => {
  app.listen(PORT, () => console.log('BookLoop Lite API running on port ' + PORT))
}).catch(error => {
  console.error('Failed to initialize BookLoop Lite:', error)
  process.exit(1)
})
