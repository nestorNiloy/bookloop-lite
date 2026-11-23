import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../AuthContext'
import api from '../api'
import './ListingDetailPage.css'

const TYPE_META = {
  BORROW: { label: 'Borrow', color: 'var(--type-borrow)', cta: 'Request to borrow' },
  RENT: { label: 'Rent', color: 'var(--type-rent)', cta: 'Request to rent' },
  SALE: { label: 'Buy', color: 'var(--type-sale)', cta: 'Buy this book' },
  EXCHANGE: { label: 'Exchange', color: 'var(--type-exchange)', cta: 'Propose exchange' },
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const [books, setBooks] = useState([])
  const [myListings, setMyListings] = useState([])
  const [message, setMessage] = useState('')
  const [offeredBookId, setOfferedBookId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [listingResponse, booksResponse, listingsResponse] = await Promise.all([
          api.get('/listings'),
          api.get('/books/mine'),
          api.get('/listings/mine'),
        ])
        if (cancelled) return
        const found = listingResponse.data.data.find(item => item.id === id)
        setListing(found ?? null)
        setBooks(booksResponse.data.data)
        setMyListings(listingsResponse.data.data)
        if (!found) setError('This listing is no longer available.')
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message ?? 'Could not load this listing. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const eligibleBooks = books.filter(book =>
    book.id !== listing?.bookId &&
    !book.isLocked &&
    !myListings.some(item => item.bookId === book.id && ['RESERVED', 'ACTIVE'].includes(item.status))
  )

  async function sendRequest() {
    setError(null)
    if (listing?.type === 'EXCHANGE' && !offeredBookId) {
      setError('Choose one of your own books to offer in exchange.')
      return
    }
    setSending(true)
    try {
      const payload = { listingId: id, message: message.trim() }
      if (listing?.type === 'EXCHANGE') payload.offeredBookId = offeredBookId
      await api.post('/requests', payload)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not send your request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div><Navbar /><div className="ldp-loading">Loading listing…</div></div>
  }
  if (!listing) {
    return (
      <div className="ldp-page">
        <Navbar />
        <div className="ldp-body">
          <button className="ldp-back" onClick={() => navigate('/')}>← Back to browse</button>
          <div className="alert alert--error">{error || 'This listing is unavailable.'}</div>
        </div>
      </div>
    )
  }

  const meta = TYPE_META[listing.type]
  const { book } = listing
  const isOwner = book.ownerId === user?.id

  return (
    <div className="ldp-page">
      <Navbar />
      <div className="ldp-body">
        <button className="ldp-back" onClick={() => navigate('/')}>← Back to browse</button>
        <div className="ldp-grid">
          <div className="ldp-visual" style={{ background: `linear-gradient(155deg, ${meta.color}, ${meta.color}aa)` }}>
            <span className="ldp-visual__pill">{meta.label}</span>
            <span className="ldp-visual__initial">{book.title.charAt(0)}</span>
          </div>
          <div className="ldp-info">
            <h1 className="ldp-title">{book.title}</h1>
            <p className="ldp-author">by {book.author}</p>
            <div className="ldp-tags">
              {book.genre && <span className="ldp-tag">{book.genre}</span>}
              <span className="ldp-tag ldp-tag--muted">{(book.condition || 'GOOD').replace('_', ' ')}</span>
            </div>
            {book.description && <p className="ldp-description">{book.description}</p>}
            <div className="ldp-price-box">
              {listing.type === 'BORROW' && <span>Free to borrow</span>}
              {listing.type === 'EXCHANGE' && <span>Offer one of your own books in trade</span>}
              {listing.type === 'RENT' && <span>€{(listing.priceCents / 100).toFixed(2)} / day · up to {listing.maxDays} days</span>}
              {listing.type === 'SALE' && <span>€{(listing.priceCents / 100).toFixed(2)}</span>}
            </div>
            <p className="ldp-owner">Owned by <strong>{book.ownerName}</strong></p>

            {error && <div className="alert alert--error">{error}</div>}
            {sent ? (
              <div className="alert alert--success">Request sent! Check Requests to follow its progress.</div>
            ) : isOwner ? (
              <div className="alert">This is your own listing. You cannot request it.</div>
            ) : (
              <div className="ldp-request-box">
                {listing.type === 'EXCHANGE' && (
                  <div className="field ldp-offer-field">
                    <label className="field__label" htmlFor="offered-book">Choose the book you are offering *</label>
                    <select
                      id="offered-book"
                      className="field__input"
                      value={offeredBookId}
                      onChange={event => setOfferedBookId(event.target.value)}
                      required
                    >
                      <option value="">Select a book from your shelf…</option>
                      {eligibleBooks.map(item => (
                        <option key={item.id} value={item.id}>{item.title} — {item.author}</option>
                      ))}
                    </select>
                    {eligibleBooks.length === 0 && <p className="ldp-help">You need an available book on your shelf before proposing an exchange.</p>}
                  </div>
                )}
                <textarea
                  className="field__input"
                  rows={3}
                  maxLength={500}
                  placeholder="Add a short message (optional)…"
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                />
                <button
                  className="btn btn--gradient btn--full"
                  onClick={sendRequest}
                  disabled={sending || (listing.type === 'EXCHANGE' && eligibleBooks.length === 0)}
                >
                  {sending ? 'Sending…' : meta.cta}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
