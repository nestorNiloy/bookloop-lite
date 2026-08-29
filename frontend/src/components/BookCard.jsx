import { Link } from 'react-router-dom'
import './BookCard.css'

const TYPE_META = {
  BORROW:   { label: 'Borrow',  color: 'var(--type-borrow)'   },
  RENT:     { label: 'Rent',    color: 'var(--type-rent)'     },
  SALE:     { label: 'Buy',     color: 'var(--type-sale)'     },
  EXCHANGE: { label: 'Exchange',color: 'var(--type-exchange)' },
}

const CONDITION_LABELS = {
  NEW: 'New', LIKE_NEW: 'Like new', GOOD: 'Good', FAIR: 'Fair', WORN: 'Worn',
}

export default function BookCard({ listing }) {
  const { book, type, priceCents, maxDays } = listing
  const meta = TYPE_META[type]

  return (
    <Link to={`/listings/${listing.id}`} className="lbcard">
      <div className="lbcard__top" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)` }}>
        <span className="lbcard__pill">{meta.label}</span>
        <span className="lbcard__initial">{book.title.charAt(0)}</span>
      </div>

      <div className="lbcard__body">
        <h3 className="lbcard__title">{book.title}</h3>
        <p className="lbcard__author">{book.author}</p>

        <div className="lbcard__meta">
          {book.genre && <span className="lbcard__tag">{book.genre}</span>}
          <span className="lbcard__tag lbcard__tag--muted">{CONDITION_LABELS[book.condition]}</span>
        </div>

        <div className="lbcard__footer">
          <span className="lbcard__price">
            {type === 'BORROW' && 'Free to borrow'}
            {type === 'EXCHANGE' && 'Trade for a book'}
            {type === 'RENT' && `€${(priceCents / 100).toFixed(2)}/day`}
            {type === 'SALE' && `€${(priceCents / 100).toFixed(2)}`}
          </span>
          {type === 'RENT' && <span className="lbcard__days">up to {maxDays}d</span>}
        </div>
      </div>
    </Link>
  )
}
