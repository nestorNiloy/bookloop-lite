import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import BookCard from '../components/BookCard'
import api from '../api'
import './CataloguePage.css'

const TYPES = [
  { value: 'BORROW', label: 'Borrow', color: 'var(--type-borrow)' },
  { value: 'RENT', label: 'Rent', color: 'var(--type-rent)' },
  { value: 'SALE', label: 'Buy', color: 'var(--type-sale)' },
  { value: 'EXCHANGE', label: 'Exchange', color: 'var(--type-exchange)' },
]

export default function CataloguePage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [type, setType] = useState(null)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadListings() {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (query) params.set('q', query)
      try {
        const response = await api.get('/listings?' + params.toString())
        if (!cancelled) setListings(response.data.data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message ?? 'Could not load the catalogue. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadListings()
    return () => { cancelled = true }
  }, [type, query])

  function handleSearch(event) {
    event.preventDefault()
    setQuery(searchInput.trim())
  }

  return (
    <div className="cat-page">
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
              onChange={event => setSearchInput(event.target.value)}
              maxLength={100}
            />
            <button className="btn btn--gradient" type="submit">Search</button>
          </form>
        </div>
      </div>

      <div className="cat-body">
        <div className="cat-filters">
          <button className={`type-chip ${type === null ? 'active' : ''}`} style={{ '--chip-color': 'var(--ink)' }} onClick={() => setType(null)}>
            All
          </button>
          {TYPES.map(item => (
            <button
              key={item.value}
              className={`type-chip ${type === item.value ? 'active' : ''}`}
              style={{ '--chip-color': item.color }}
              onClick={() => setType(type === item.value ? null : item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert--error cat-error">
            {error}{' '}
            <button type="button" className="cat-retry" onClick={() => setType(current => current)}>Retry</button>
          </div>
        )}
        {loading && <div className="cat-grid">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="cat-skeleton" />)}</div>}
        {!loading && !error && listings.length === 0 && <div className="cat-empty"><p>No listings match your search.</p></div>}
        {!loading && listings.length > 0 && <div className="cat-grid">{listings.map(item => <BookCard key={item.id} listing={item} />)}</div>}
      </div>
    </div>
  )
}
