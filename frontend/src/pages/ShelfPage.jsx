import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import './ShelfPage.css'

const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'WORN']
const TYPES = [
  { value: 'BORROW',   label: 'Borrow',   color: 'var(--type-borrow)'   },
  { value: 'RENT',     label: 'Rent',     color: 'var(--type-rent)'     },
  { value: 'SALE',     label: 'Buy',      color: 'var(--type-sale)'     },
  { value: 'EXCHANGE', label: 'Exchange', color: 'var(--type-exchange)' },
]

export default function ShelfPage() {
  const [books, setBooks] = useState([])
  const [listings, setListings] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ title: '', author: '', genre: '', condition: 'GOOD', description: '' })

  function refresh() {
    api.get('/books/mine').then(res => setBooks(res.data.data))
    api.get('/listings/mine').then(res => setListings(res.data.data))
  }

  useEffect(refresh, [])

  async function addBook(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/books', form)
      setForm({ title: '', author: '', genre: '', condition: 'GOOD', description: '' })
      setShowForm(false)
      refresh()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to add book.')
    }
  }

  async function deleteBook(id) {
    if (!confirm('Remove this book from your shelf?')) return
    try {
      await api.delete(`/books/${id}`)
      refresh()
    } catch (err) {
      alert(err.response?.data?.error?.message ?? 'Failed to delete.')
    }
  }

  function listingsForBook(bookId) {
    return listings.filter(l => l.bookId === bookId)
  }

  return (
    <div className="shelf-page">
      <Navbar />

      <div className="shelf-body">
        <div className="shelf-header">
          <div>
            <h1>My Shelf</h1>
            <p>{books.length} {books.length === 1 ? 'book' : 'books'}</p>
          </div>
          <button className="btn btn--gradient" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Add a book'}
          </button>
        </div>

        {showForm && (
          <form className="shelf-form glass-card" onSubmit={addBook}>
            {error && <div className="alert alert--error">{error}</div>}
            <div className="shelf-form__grid">
              <div className="field">
                <label className="field__label">Title</label>
                <input className="field__input" required value={form.title}
                       onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="field">
                <label className="field__label">Author</label>
                <input className="field__input" required value={form.author}
                       onChange={e => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="field">
                <label className="field__label">Genre</label>
                <input className="field__input" value={form.genre}
                       onChange={e => setForm({ ...form, genre: e.target.value })} />
              </div>
              <div className="field">
                <label className="field__label">Condition</label>
                <select className="field__input" value={form.condition}
                        onChange={e => setForm({ ...form, condition: e.target.value })}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn--gradient">Add to shelf</button>
          </form>
        )}

        <div className="shelf-list">
          {books.map(book => (
            <ShelfBookRow
              key={book.id}
              book={book}
              listings={listingsForBook(book.id)}
              onDelete={() => deleteBook(book.id)}
              onListingCreated={refresh}
            />
          ))}
          {books.length === 0 && !showForm && (
            <div className="shelf-empty">
              <p>Your shelf is empty. Add your first book to start sharing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ShelfBookRow({ book, listings, onDelete, onListingCreated }) {
  const [showListingForm, setShowListingForm] = useState(false)
  const [listingType, setListingType] = useState('BORROW')
  const [price, setPrice] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [error, setError] = useState(null)

  async function createListing(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/listings', {
        bookId: book.id,
        type: listingType,
        priceCents: price ? Math.round(parseFloat(price) * 100) : undefined,
        maxDays: maxDays ? parseInt(maxDays) : undefined,
      })
      setShowListingForm(false)
      setPrice(''); setMaxDays('')
      onListingCreated()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to create listing.')
    }
  }

  const needsPrice = listingType === 'RENT' || listingType === 'SALE'
  const needsDays = listingType === 'RENT'

  return (
    <div className="shelf-row glass-card">
      <div className="shelf-row__main">
        <div>
          <h3>{book.title}</h3>
          <p>{book.author} · {book.condition.replace('_', ' ')}</p>
        </div>
        <div className="shelf-row__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setShowListingForm(s => !s)}>
            {showListingForm ? 'Cancel' : '+ List'}
          </button>
          <button className="btn btn--danger-ghost btn--sm" onClick={onDelete}>Remove</button>
        </div>
      </div>

      {listings.length > 0 && (
        <div className="shelf-row__listings">
          {listings.map(l => {
            const meta = TYPES.find(t => t.value === l.type)
            return (
              <span key={l.id} className="shelf-listing-pill" style={{ background: meta.color }}>
                {meta.label} · {l.status}
              </span>
            )
          })}
        </div>
      )}

      {showListingForm && (
        <form className="shelf-row__form" onSubmit={createListing}>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="shelf-row__form-grid">
            <select className="field__input" value={listingType} onChange={e => setListingType(e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {needsPrice && (
              <input className="field__input" type="number" step="0.01" placeholder="Price (€)"
                     value={price} onChange={e => setPrice(e.target.value)} required />
            )}
            {needsDays && (
              <input className="field__input" type="number" placeholder="Max days"
                     value={maxDays} onChange={e => setMaxDays(e.target.value)} required />
            )}
          </div>
          <button type="submit" className="btn btn--gradient btn--sm">Create listing</button>
        </form>
      )}
    </div>
  )
}
