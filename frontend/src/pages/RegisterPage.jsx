import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post('/auth/register', form)
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
          Create your account
        </h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Free forever. Takes less than a minute.
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field__label">Full name</label>
            <input className="field__input" type="text" placeholder="Ada Lovelace" required
                   value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label">Email</label>
            <input className="field__input" type="email" placeholder="ada@example.com" required
                   value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input className="field__input" type="password" placeholder="At least 8 characters" required minLength={8}
                   value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>

          <button type="submit" className="btn btn--gradient btn--full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--grad-2)', fontWeight: 700 }}>Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  )
}
