import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api'
import './ListingDetailPage.css'

const TYPE_META = {
  BORROW:   { label: 'Borrow',   color: 'var(--type-borrow)',   cta: 'Request to borrow' },
  RENT:     { label: 'Rent',     color: 'var(--type-rent)',     cta: 'Request to rent'   },
  SALE:     { label: 'Buy',      color: 'var(--type-sale)',     cta: 'Buy this book'     },
  EXCHANGE: { label: 'Exchange', color: 'var(--type-exchange)', cta: 'Propose exchange'  },
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/listings').then(res => {
      const found = res.data.data.find(l => l.id === id)
      setListing(found)
    })
  }, [id])

  async function sendRequest() {
    setError(null)
    setSending(true)
    try {
      await api.post('/requests', { listingId: id, message })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  if (!listing) {
    return (
      <div>
        <Navbar />
        <div className="ldp-loading">Loading…</div>
      </div>
    )
  }

  const meta = TYPE_META[listing.type]
  const { book } = listing

  return (
    <div className="ldp-page">
      <Navbar />

      <div className="ldp-body">
        <button className="ldp-back" onClick={() => navigate('/')}>← Back to browse</button>

        <div className="ldp-grid">
          {/* Left — visual */}
          <div className="ldp-visual" style={{ background: `linear-gradient(155deg, ${meta.color}, ${meta.color}aa)` }}>
            <span className="ldp-visual__pill">{meta.label}</span>
            <span className="ldp-visual__initial">{book.title.charAt(0)}</span>
          </div>

          {/* Right — details */}
          <div className="ldp-info">
            <h1 className="ldp-title">{book.title}</h1>
            <p className="ldp-author">by {book.author}</p>

            <div className="ldp-tags">
              {book.genre && <span className="ldp-tag">{book.genre}</span>}
              <span className="ldp-tag ldp-tag--muted">{book.condition.replace('_', ' ')}</span>
            </div>

            {book.description && <p className="ldp-description">{book.description}</p>}

            <div className="ldp-price-box">
              {listing.type === 'BORROW' && <span>Free to borrow</span>}
              {listing.type === 'EXCHANGE' && <span>Offer one of your own books in trade</span>}
              {listing.type === 'RENT' && <span>€{(listing.priceCents / 100).toFixed(2)} / day · up to {listing.maxDays} days</span>}
              {listing.type === 'SALE' && <span>€{(listing.priceCents / 100).toFixed(2)}</span>}
            </div>

            <p className="ldp-owner">Owned by <strong>{book.ownerName}</strong></p>

            {!sent ? (
              <div className="ldp-request-box">
                {error && <div className="alert alert--error">{error}</div>}
                <textarea
                  className="field__input"
                  rows={3}
                  placeholder="Add a short message (optional)…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                <button className="btn btn--gradient btn--full" onClick={sendRequest} disabled={sending}>
                  {sending ? 'Sending…' : meta.cta}
                </button>
              </div>
            ) : (
              <div className="alert alert--success">
                Request sent! The owner will be notified. Check "Requests" to track it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
