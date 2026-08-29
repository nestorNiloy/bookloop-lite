import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import './RequestsPage.css'

const STATUS_COLORS = {
  REQUESTED: '#A855F7',
  ACCEPTED:  '#10B981',
  DECLINED:  '#EF4444',
  COMPLETED: '#4E7FFF',
}

export default function RequestsPage() {
  const [tab, setTab] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])

  function refresh() {
    api.get('/requests/incoming').then(res => setIncoming(res.data.data))
    api.get('/requests/outgoing').then(res => setOutgoing(res.data.data))
  }

  useEffect(refresh, [])

  async function act(id, action) {
    try {
      await api.patch(`/requests/${id}/${action}`)
      refresh()
    } catch (err) {
      alert(err.response?.data?.error?.message ?? 'Action failed.')
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

        {list.length === 0 && (
          <div className="req-empty">
            <p>No {tab} requests yet.</p>
          </div>
        )}

        <div className="req-list">
          {list.map(r => (
            <div className="req-card glass-card" key={r.id}>
              <div className="req-card__top">
                <div>
                  <h3>{r.listing?.book?.title}</h3>
                  <p>
                    {tab === 'incoming'
                      ? <>Requested by <strong>{r.requesterName}</strong></>
                      : <>Owned by <strong>{r.ownerName}</strong></>}
                  </p>
                </div>
                <span className="req-status" style={{ background: STATUS_COLORS[r.status] }}>
                  {r.status}
                </span>
              </div>

              {r.message && <p className="req-message">"{r.message}"</p>}

              {/* Contact reveal — only shown once ACCEPTED or COMPLETED */}
              {(r.status === 'ACCEPTED' || r.status === 'COMPLETED') && (
                <div className="req-contact">
                  📬 Contact: <strong>{tab === 'incoming' ? r.requesterEmail : r.ownerEmail}</strong>
                </div>
              )}

              {tab === 'incoming' && r.status === 'REQUESTED' && (
                <div className="req-actions">
                  <button className="btn btn--gradient btn--sm" onClick={() => act(r.id, 'accept')}>Accept</button>
                  <button className="btn btn--danger-ghost btn--sm" onClick={() => act(r.id, 'decline')}>Decline</button>
                </div>
              )}

              {r.status === 'ACCEPTED' && (
                <div className="req-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => act(r.id, 'complete')}>
                    Mark as completed
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
