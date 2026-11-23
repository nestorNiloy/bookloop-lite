import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { fileURLToPath } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = process.env.BOOKLOOP_DB_FILE || path.join(__dirname, '..', 'data.json')

const defaultData = { users: [], books: [], listings: [], requests: [] }

export const db = new Low(new JSONFile(file), defaultData)

export async function initDb() {
  await db.read()
  db.data ||= defaultData

  // Seed only once — if there's already a user, skip
  if (db.data.users.length === 0) {
    const passwordHash = bcrypt.hashSync('password123', 10)

    const alice = { id: nanoid(), name: 'Alice Müller', email: 'alice@bookloop.dev', passwordHash, createdAt: Date.now() }
    const ben   = { id: nanoid(), name: 'Ben Schmidt',  email: 'ben@bookloop.dev',   passwordHash, createdAt: Date.now() }
    const clara = { id: nanoid(), name: 'Clara Novak',  email: 'clara@bookloop.dev', passwordHash, createdAt: Date.now() }
    db.data.users.push(alice, ben, clara)

    const books = [
      { id: nanoid(), ownerId: alice.id, title: 'The Pragmatic Programmer', author: 'David Thomas', genre: 'Technology', condition: 'GOOD', description: 'Classic. A few highlighted passages.' },
      { id: nanoid(), ownerId: alice.id, title: 'Clean Code', author: 'Robert Martin', genre: 'Technology', condition: 'LIKE_NEW', description: 'Barely touched.' },
      { id: nanoid(), ownerId: ben.id,   title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', condition: 'FAIR', description: 'Well loved, all pages intact.' },
      { id: nanoid(), ownerId: ben.id,   title: 'Atomic Habits', author: 'James Clear', genre: 'Self-Help', condition: 'GOOD', description: 'Great read, some dog-eared pages.' },
      { id: nanoid(), ownerId: clara.id, title: 'The Design of Everyday Things', author: 'Don Norman', genre: 'Design', condition: 'LIKE_NEW', description: 'Unread — had a duplicate.' },
      { id: nanoid(), ownerId: clara.id, title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'History', condition: 'GOOD', description: 'A thought-provoking read.' },
    ]
    db.data.books.push(...books)

    const listings = [
      { id: nanoid(), bookId: books[0].id, type: 'BORROW', status: 'AVAILABLE', priceCents: null, maxDays: null, createdAt: Date.now() },
      { id: nanoid(), bookId: books[1].id, type: 'SALE',   status: 'AVAILABLE', priceCents: 1200, maxDays: null, createdAt: Date.now() },
      { id: nanoid(), bookId: books[2].id, type: 'BORROW', status: 'AVAILABLE', priceCents: null, maxDays: null, createdAt: Date.now() },
      { id: nanoid(), bookId: books[3].id, type: 'EXCHANGE', status: 'AVAILABLE', priceCents: null, maxDays: null, createdAt: Date.now() },
      { id: nanoid(), bookId: books[4].id, type: 'RENT',   status: 'AVAILABLE', priceCents: 150, maxDays: 21, createdAt: Date.now() },
      { id: nanoid(), bookId: books[5].id, type: 'SALE',   status: 'AVAILABLE', priceCents: 1800, maxDays: null, createdAt: Date.now() },
    ]
    db.data.listings.push(...listings)

    await db.write()
    console.log('Seeded demo data — 3 users, 6 books, 6 listings')
  }
}
