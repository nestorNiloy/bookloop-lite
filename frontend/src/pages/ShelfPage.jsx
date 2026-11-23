import { useState, useEffect, useCallback } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import './ShelfPage.css'

const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'WORN']
const TYPES = [
  { value: 'BORROW', label: 'Borrow', color: 'var(--type-borrow)' },
  { value: 'RENT', label: 'Rent', color: 'var(--type-rent)' },
  { value: 'SALE', label: 'Buy', color: 'var(--type-sale)' },
  { value: 'EXCHANGE', label: 'Exchange', color: 'var(--type-exchange)' },
]

export default function ShelfPage() {
  const [books, setBooks] = useState([])
  const [listings, setListings] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', author: '', genre: '', condition: 'GOOD', description: '' })

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [booksResponse, listingsResponse] = await Promise.all([
        api.get('/books/mine'),
        api.get('/listings/mine'),
      ])
      setBooks(booksResponse.data.data)
      setListings(listingsResponse.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not load your shelf. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function addBook(event) {
    event.preventDefault()
    setError(null)
    try {
      await api.post('/books', form)
      setForm({ title: '', author: '', genre: '', condition: 'GOOD', description: '' })
      setShowForm(false)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to add book.')
    }
  }

  async function deleteBook(id) {
    if (!window.confirm('Remove this book from your shelf?')) return
    setError(null)
    try {
      await api.delete('/books/' + id)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to remove this book.')
    }
  }

  function listingsForBook(bookId) {
    return listings.filter(listing => listing.bookId === bookId)
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
          <button className="btn btn--gradient" onClick={() => setShowForm(value => !value)}>
            {showForm ? 'Cancel' : '+ Add a book'}
          </button>
        </div>

        {error && <div className="alert alert--error shelf-error">{error}</div>}
        {showForm && (
          <form className="shelf-form glass-card" onSubmit={addBook}>
            <div className="shelf-form__grid">
              <div className="field">
                <label className="field__label" htmlFor="book-title">Title</label>
                <input id="book-title" className="field__input" required maxLength={160} value={form.title}
                  onChange={event => setForm({ ...form, title: event.target.value })} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="book-author">Author</label>
                <input id="book-author" className="field__input" required maxLength={120} value={form.author}
                  onChange={event => setForm({ ...form, author: event.target.value })} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="book-genre">Genre</label>
                <input id="book-genre" className="field__input" maxLength={60} value={form.genre}
                  onChange={event => setForm({ ...form, genre: event.target.value })} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="book-condition">Condition</label>
                <select id="book-condition" className="field__input" value={form.condition}
                  onChange={event => setForm({ ...form, condition: event.target.value })}>
                  {CONDITIONS.map(condition => <option key={condition} value={condition}>{condition.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="field shelf-description-field">
                <label className="field__label" htmlFor="book-description">Description (optional)</label>
                <textarea id="book-description" className="field__input" rows={2} maxLength={1000} value={form.description}
                  onChange={event => setForm({ ...form, description: event.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn--gradient">Add to shelf</button>
          </form>
        )}

        {loading ? <div className="shelf-empty">Loading your books…</div> : (
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
              <div className="shelf-empty"><p>Your shelf is empty. Add your first book to start sharing.</p></div>
            )}
          </div>
        )}
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
  const [saving, setSaving] = useState(false)

  async function createListing(event) {
    event.preventDefault()
    setError(null)
    const parsedPrice = Number(price)
    const parsedDays = Number(maxDays)
    if ((listingType === 'RENT' || listingType === 'SALE') && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setError('Enter a valid price greater than zero.')
      return
    }
    if (listingType === 'RENT' && (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365)) {
      setError('Rental duration must be between 1 and 365 days.')
      return
    }

    setSaving(true)
    try {
      await api.post('/listings', {
        bookId: book.id,
        type: listingType,
        priceCents: listingType === 'RENT' || listingType === 'SALE' ? Math.round(parsedPrice * 100) : undefined,
        maxDays: listingType === 'RENT' ? parsedDays : undefined,
      })
      setShowListingForm(false)
      setPrice('')
      setMaxDays('')
      await onListingCreated()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to create listing.')
    } finally {
      setSaving(false)
    }
  }

  const needsPrice = listingType === 'RENT' || listingType === 'SALE'
  const needsDays = listingType === 'RENT'

  return (
    <div className="shelf-row glass-card">
      <div className="shelf-row__main">
        <div>
          <h3>{book.title}</h3>
          <p>{book.author} · {(book.condition || 'GOOD').replace('_', ' ')}</p>
        </div>
        <div className="shelf-row__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setShowListingForm(value => !value)}>
            {showListingForm ? 'Cancel' : '+ List'}
          </button>
          <button className="btn btn--danger-ghost btn--sm" onClick={onDelete}>Remove</button>
        </div>
      </div>

      {listings.length > 0 && (
        <div className="shelf-row__listings">
          {listings.map(listing => {
            const meta = TYPES.find(item => item.value === listing.type)
            return <span key={listing.id} className="shelf-listing-pill" style={{ background: meta?.color ?? 'var(--ink-muted)' }}>
              {meta?.label ?? listing.type} · {listing.status}
            </span>
          })}
        </div>
      )}

      {showListingForm && (
        <form className="shelf-row__form" onSubmit={createListing}>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="shelf-row__form-grid">
            <select className="field__input" value={listingType} onChange={event => setListingType(event.target.value)}>
              {TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {needsPrice && <input className="field__input" type="number" min="0.01" step="0.01" placeholder="Price (€)" value={price} onChange={event => setPrice(event.target.value)} required />}
            {needsDays && <input className="field__input" type="number" min="1" max="365" step="1" placeholder="Max days" value={maxDays} onChange={event => setMaxDays(event.target.value)} required />}
          </div>
          <button type="submit" className="btn btn--gradient btn--sm" disabled={saving}>
            {saving ? 'Creating…' : 'Create listing'}
          </button>
        </form>
      )}
    </div>
  )
}
