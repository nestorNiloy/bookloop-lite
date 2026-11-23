import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const isActive = path => location.pathname === path

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__logo">
        Book<span className="gradient-text">Loop</span>
      </Link>
      <div className="navbar__links">
        <Link to="/" className={`navbar__link ${isActive('/') ? 'active' : ''}`}>Browse</Link>
        <Link to="/shelf" className={`navbar__link ${isActive('/shelf') ? 'active' : ''}`}>My Shelf</Link>
        <Link to="/requests" className={`navbar__link ${isActive('/requests') ? 'active' : ''}`}>Requests</Link>
      </div>
      <div className="navbar__right">
        <span className="navbar__user">{user?.name}</span>
        <button className="btn btn--ghost btn--sm" onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  )
}
