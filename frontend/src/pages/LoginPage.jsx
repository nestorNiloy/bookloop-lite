import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post('/auth/login', form)
      setUser(res.data.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 600, marginBottom: 4 }}>
          Welcome back
        </h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Sign in to continue browsing.
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field__label">Email</label>
            <input className="field__input" type="email" placeholder="ada@example.com" required
                   value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input className="field__input" type="password" placeholder="Your password" required
                   value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>

          <button type="submit" className="btn btn--gradient btn--full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem', padding: '0.85rem 1rem', background: 'var(--paper-dim)',
          borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--ink-muted)'
        }}>
          <strong style={{ color: 'var(--ink-soft)' }}>Try a demo account:</strong><br />
          alice@bookloop.dev · ben@bookloop.dev · clara@bookloop.dev<br />
          password: <code>password123</code>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
          No account yet?{' '}
          <Link to="/register" style={{ color: 'var(--grad-2)', fontWeight: 700 }}>Create one</Link>
        </p>
      </div>
    </AuthLayout>
  )
}
