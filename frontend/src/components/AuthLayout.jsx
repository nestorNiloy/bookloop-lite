import './AuthLayout.css'

export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-hero">
        {/* Ambient gradient orbs */}
        <div className="gradient-orb" style={{ width: 380, height: 380, background: 'var(--grad-3)', top: -100, right: -80 }} />
        <div className="gradient-orb" style={{ width: 300, height: 300, background: 'var(--grad-4)', bottom: -60, left: -60, opacity: 0.4 }} />

        <div className="auth-hero__content">
          <div className="auth-hero__logo">Book<span>Loop</span></div>
          <h1 className="auth-hero__headline">
            Every book<br />deserves<br />another reader.
          </h1>
          <p className="auth-hero__sub">
            Borrow, rent, buy, or trade books with people nearby.
            Turn your shelf into a small, generous library.
          </p>

          <div className="auth-hero__stats">
            <div>
              <strong>4</strong>
              <span>ways to share a book</span>
            </div>
            <div>
              <strong>0€</strong>
              <span>to join the loop</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        {children}
      </div>
    </div>
  )
}
