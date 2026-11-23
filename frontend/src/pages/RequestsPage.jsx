import { useState, useEffect, useCallback } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import './RequestsPage.css'

const STATUS_COLORS = {
  REQUESTED: '#A855F7',
  ACCEPTED: '#10B981',
  DECLINED: '#EF4444',
  COMPLETED: '#4E7FFF',
}

export default function RequestsPage() {
  const [tab, setTab] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        api.get('/requests/incoming'),
        api.get('/requests/outgoing'),
      ])
      setIncoming(incomingResponse.data.data)
      setOutgoing(outgoingResponse.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not load requests. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function act(id, action) {
    setBusyId(id)
    setError(null)
    try {
      await api.patch(`/requests/${id}/${action}`)
      await refresh()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Action failed. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const list = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="req-page">
      <Navbar />
      <div className="req-body">
        <h1>Requests</h1>
        <div className="req-tabs">
          <button className={`req-tab ${tab === 'incoming' ? 'active' : ''}`} onClick={() => setTab('incoming')}>
            Incoming ({incoming.length})
          </button>
          <button className={`req-tab ${tab === 'outgoing' ? 'active' : ''}`} onClick={() => setTab('outgoing')}>
            Outgoing ({outgoing.length})
          </button>
        </div>

        {error && <div className="alert alert--error req-error">{error}</div>}
        {loading && <div className="req-empty">Loading requests…</div>}
        {!loading && list.length === 0 && <div className="req-empty"><p>No {tab} requests yet.</p></div>}

        <div className="req-list">
          {list.map(request => (
            <div className="req-card glass-card" key={request.id}>
              <div className="req-card__top">
                <div>
                  <h3>{request.listing?.book?.title ?? 'Book listing'}</h3>
                  <p>
                    {tab === 'incoming'
                      ? <>Requested by <strong>{request.requesterName}</strong></>
                      : <>Owned by <strong>{request.ownerName}</strong></>}
                  </p>
                  <span className="req-type">{request.listing?.type ?? 'REQUEST'}</span>
                </div>
                <span className="req-status" style={{ background: STATUS_COLORS[request.status] ?? '#667085' }}>
                  {request.status}
                </span>
              </div>

              {request.listing?.type === 'EXCHANGE' && (
                <div className="req-exchange">
                  <strong>Offered in exchange:</strong>{' '}
                  {request.offeredBook
                    ? <>{request.offeredBook.title} <span>by {request.offeredBook.author}</span></>
                    : <span className="req-missing">Offered book details unavailable</span>}
                </div>
              )}
              {request.message && <p className="req-message">“{request.message}”</p>}

              {(request.status === 'ACCEPTED' || request.status === 'COMPLETED') && (
                <div className="req-contact">
                  📬 Contact: <strong>{tab === 'incoming' ? request.requesterEmail : request.ownerEmail}</strong>
                </div>
              )}

              {tab === 'incoming' && request.status === 'REQUESTED' && (
                <div className="req-actions">
                  <button className="btn btn--gradient btn--sm" disabled={busyId === request.id} onClick={() => act(request.id, 'accept')}>
                    {busyId === request.id ? 'Working…' : 'Accept'}
                  </button>
                  <button className="btn btn--danger-ghost btn--sm" disabled={busyId === request.id} onClick={() => act(request.id, 'decline')}>
                    Decline
                  </button>
                </div>
              )}
              {request.status === 'ACCEPTED' && (
                <div className="req-actions">
                  <button className="btn btn--ghost btn--sm" disabled={busyId === request.id} onClick={() => act(request.id, 'complete')}>
                    {busyId === request.id ? 'Completing…' : 'Mark as completed'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
