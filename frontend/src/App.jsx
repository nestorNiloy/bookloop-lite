import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CataloguePage from './pages/CataloguePage'
import ListingDetailPage from './pages/ListingDetailPage'
import ShelfPage from './pages/ShelfPage'
import RequestsPage from './pages/RequestsPage'
import './index.css'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading BookLoop…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Guest({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading BookLoop…</div>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Guest><LoginPage /></Guest>} />
          <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
          <Route path="/" element={<Protected><CataloguePage /></Protected>} />
          <Route path="/listings/:id" element={<Protected><ListingDetailPage /></Protected>} />
          <Route path="/shelf" element={<Protected><ShelfPage /></Protected>} />
          <Route path="/requests" element={<Protected><RequestsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
