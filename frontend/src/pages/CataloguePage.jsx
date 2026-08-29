import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import BookCard from '../components/BookCard'
import api from '../api'
import './CataloguePage.css'

const TYPES = [
  { value: 'BORROW',   label: 'Borrow',   color: 'var(--type-borrow)'   },
  { value: 'RENT',     label: 'Rent',     color: 'var(--type-rent)'     },
  { value: 'SALE',     label: 'Buy',      color: 'var(--type-sale)'     },
  { value: 'EXCHANGE', label: 'Exchange', color: 'var(--type-exchange)' },
]

export default function CataloguePage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState(null)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (query) params.set('q', query)

    api.get(`/listings?${params}`)
      .then(res => setListings(res.data.data))
      .finally(() => setLoading(false))
  }, [type, query])

  function handleSearch(e) {
    e.preventDefault()
    setQuery(searchInput.trim())
  }

  return (
    <div className="cat-page">
      {/* Gradient hero strip */}
      <div className="cat-hero">
        <div className="gradient-orb" style={{ width: 260, height: 260, background: 'var(--grad-3)', top: -100, right: '15%' }} />
        <Navbar />
        <div className="cat-hero__content">
          <h1>Find your next <span className="gradient-text-light">read</span></h1>
          <form className="cat-search" onSubmit={handleSearch}>
            <input
              className="cat-search__input"
              placeholder="Search by title or author…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            <button className="btn btn--gradient" type="submit">Search</button>
          </form>
        </div>
      </div>

      <div className="cat-body">
        {/* Type filter chips */}
        <div className="cat-filters">
          <button
            className={`type-chip ${type === null ? 'active' : ''}`}
            style={{ '--chip-color': 'var(--ink)' }}
            onClick={() => setType(null)}
          >
            All
          </button>
          {TYPES.map(t => (
            <button
              key={t.value}
              className={`type-chip ${type === t.value ? 'active' : ''}`}
              style={{ '--chip-color': t.color }}
              onClick={() => setType(type === t.value ? null : t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="cat-grid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cat-skeleton" />)}
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div className="cat-empty">
            <p>No listings match your search.</p>
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div className="cat-grid">
            {listings.map(listing => <BookCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </div>
    </div>
  )
}
