import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck
} from 'lucide-react'
import { useAuth } from './AuthProvider'
import { apiUrl, ApiError } from './api'
import { lessons } from './content/lessons'

interface LandingPageProps {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'The request could not be completed. Please try again.'
}

export function LandingPage({ theme, setTheme }: LandingPageProps) {
  const { status, user, login, signup, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccessMessage('')
    try {
      await login(email, password)
      navigate('/overview')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await signup(name, email, password, confirmPassword)
      if (res.requiresEmailVerification) {
        setSuccessMessage('Account created! Please check your email to verify before signing in.')
      } else {
        navigate('/overview')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing-root">
      {/* Minimal Top Header */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand">
            <span className="brand-mark">
              <Layers3 size={17} />
            </span>
            <span className="brand-name">
              deep<span>nova</span>
            </span>
            <span className="brand-badge">STUDIO</span>
          </Link>

          <nav className="landing-links">
            <Link to="/curriculum" className="landing-nav-link">Curriculum</Link>
            <Link to="/playground" className="landing-nav-link">Playground</Link>
            <Link to="/interviews" className="landing-nav-link">Interview Prep</Link>
          </nav>

          <div className="landing-nav-actions">
            <button
              className="landing-theme-toggle"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {status === 'authenticated' ? (
              <button
                className="button button-dark landing-cta-btn"
                onClick={() => navigate('/overview')}
              >
                Go to Studio <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="landing-ghost-btn"
                onClick={() => navigate('/overview')}
              >
                Explore as Guest
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Lots of Whitespace & Direct Login Credentials */}
      <main className="landing-hero-section">
        <div className="landing-hero-container">
          {/* Left Column: Vision & Value Proposition */}
          <div className="landing-hero-content">
            <div className="landing-kicker">
              <span>✳</span> FIELD NOTES 01 · MACHINE LEARNING STUDIO
            </div>

            <h1 className="landing-headline">
              Understand machine learning from <em>first principles</em>.
            </h1>

            <p className="landing-subhead">
              Visual parameter-space simulators, intuitive derivations, and 17 comprehensive lessons—from linear regression to modern transformers.
            </p>

            <div className="landing-feature-bullets">
              <div className="landing-bullet">
                <span className="bullet-dot" />
                <span><strong>17 authored interactive lessons</strong> with live formulas and geometric intuitions</span>
              </div>
              <div className="landing-bullet">
                <span className="bullet-dot" />
                <span><strong>Real-time visual labs:</strong> gradient descent, decision boundaries, KNN, and clustering</span>
              </div>
              <div className="landing-bullet">
                <span className="bullet-dot" />
                <span><strong>Zero-barrier:</strong> learn anonymously in guest mode or sync across devices</span>
              </div>
            </div>

            <div className="landing-guest-prompt">
              <span>Want to look around first?</span>{' '}
              <button
                type="button"
                className="landing-text-action"
                onClick={() => navigate('/overview')}
              >
                Launch Studio in Guest Mode <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Right Column: Clean, Minimalist Login / Signup Card */}
          <div className="landing-auth-wrapper">
            <div className="landing-auth-card">
              {status === 'authenticated' && user ? (
                /* Authenticated State */
                <div className="landing-auth-active">
                  <div className="landing-active-user-header">
                    <div className="landing-active-avatar">
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <span className="landing-active-eyebrow">WELCOME BACK</span>
                      <h3 className="landing-active-name">{user.name}</h3>
                      <p className="landing-active-email">{user.email}</p>
                    </div>
                  </div>

                  <div className="landing-active-status-row">
                    <span className="landing-badge-verified">
                      <UserCheck size={12} /> {user.emailVerified ? 'Verified Account' : 'Account Active'}
                    </span>
                    <span className="landing-active-meta">Cloud Synced</span>
                  </div>

                  <div className="landing-active-actions">
                    <button
                      className="button button-dark landing-submit-btn"
                      onClick={() => navigate('/overview')}
                    >
                      Open Learning Studio <ArrowRight size={15} />
                    </button>
                    <button
                      className="landing-ghost-btn"
                      style={{ width: '100%', marginTop: '8px' }}
                      onClick={() => void logout()}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated: Clean Sign In / Sign Up Form */
                <>
                  <div className="landing-auth-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'signin'}
                      className={`landing-auth-tab ${tab === 'signin' ? 'landing-auth-tab-active' : ''}`}
                      onClick={() => { setTab('signin'); setError(''); setSuccessMessage('') }}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'signup'}
                      className={`landing-auth-tab ${tab === 'signup' ? 'landing-auth-tab-active' : ''}`}
                      onClick={() => { setTab('signup'); setError(''); setSuccessMessage('') }}
                    >
                      Create Account
                    </button>
                  </div>

                  <div className="landing-auth-body">
                    {/* Google OAuth Quick Sign In */}
                    <button
                      className="google-auth-button landing-google-btn"
                      type="button"
                      onClick={() => window.location.assign(`${apiUrl('/auth/google')}?returnTo=/overview`)}
                    >
                      <span className="google-mark">G</span>
                      Continue with Google
                    </button>

                    <div className="auth-divider landing-divider">
                      <span>or continue with email</span>
                    </div>

                    {error && (
                      <div className="auth-message auth-message-error" role="alert">
                        {error}
                      </div>
                    )}

                    {successMessage && (
                      <div className="auth-message auth-message-success" role="status">
                        {successMessage}
                      </div>
                    )}

                    {tab === 'signin' ? (
                      /* Sign In Form */
                      <form className="landing-form" onSubmit={handleSignIn}>
                        <div className="landing-field">
                          <label htmlFor="landing-email">Email</label>
                          <input
                            id="landing-email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>

                        <div className="landing-field">
                          <div className="landing-label-row">
                            <label htmlFor="landing-password">Password</label>
                            <Link to="/forgot-password" className="landing-forgot-link">
                              Forgot?
                            </Link>
                          </div>
                          <input
                            id="landing-password"
                            type="password"
                            required
                            autoComplete="current-password"
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>

                        <button
                          className="button button-dark landing-submit-btn"
                          type="submit"
                          disabled={busy}
                        >
                          {busy && <LoaderCircle size={15} className="auth-spinner" />}
                          Sign in to Studio <ArrowRight size={14} />
                        </button>
                      </form>
                    ) : (
                      /* Sign Up Form */
                      <form className="landing-form" onSubmit={handleSignUp}>
                        <div className="landing-field">
                          <label htmlFor="signup-name">Full name</label>
                          <input
                            id="signup-name"
                            type="text"
                            required
                            maxLength={100}
                            placeholder="Ada Lovelace"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>

                        <div className="landing-field">
                          <label htmlFor="signup-email">Email</label>
                          <input
                            id="signup-email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>

                        <div className="landing-field">
                          <label htmlFor="signup-password">
                            Password <small>(min 12 characters)</small>
                          </label>
                          <input
                            id="signup-password"
                            type="password"
                            required
                            minLength={12}
                            autoComplete="new-password"
                            placeholder="At least 12 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>

                        <div className="landing-field">
                          <label htmlFor="signup-confirm">Confirm password</label>
                          <input
                            id="signup-confirm"
                            type="password"
                            required
                            minLength={12}
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>

                        <button
                          className="button button-dark landing-submit-btn"
                          type="submit"
                          disabled={busy}
                        >
                          {busy && <LoaderCircle size={15} className="auth-spinner" />}
                          Create Account <ArrowRight size={14} />
                        </button>
                      </form>
                    )}

                    <div className="landing-guest-fallback">
                      <button
                        type="button"
                        onClick={() => navigate('/overview')}
                        className="landing-guest-link"
                      >
                        Skip for now and continue as guest →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Spacious 3-Pillar Feature Section */}
      <section className="landing-pillars-section">
        <div className="landing-pillars-inner">
          <div className="landing-section-intro">
            <span className="landing-section-eyebrow">WHAT'S INSIDE</span>
            <h2 className="landing-section-title">A focused studio for serious understanding.</h2>
            <p className="landing-section-desc">
              Designed with abundant negative space so you can concentrate on conceptual clarity rather than cognitive clutter.
            </p>
          </div>

          <div className="landing-pillars-grid">
            <div className="landing-pillar-card">
              <span className="pillar-index">01</span>
              <div className="pillar-icon-wrap">
                <FlaskConical size={20} />
              </div>
              <h3>Visual Simulators</h3>
              <p>
                Manipulate learning rates, loss functions, decision boundaries, and polynomial fits in real-time interactive canvases.
              </p>
            </div>

            <div className="landing-pillar-card">
              <span className="pillar-index">02</span>
              <div className="pillar-icon-wrap">
                <BookOpen size={20} />
              </div>
              <h3>First-Principles Curriculum</h3>
              <p>
                17 curated lessons covering linear models, logistic regression, decision trees, neural backpropagation, and transformer attention.
              </p>
            </div>

            <div className="landing-pillar-card">
              <span className="pillar-index">03</span>
              <div className="pillar-icon-wrap">
                <ShieldCheck size={20} />
              </div>
              <h3>Frictionless Privacy</h3>
              <p>
                All lesson progress, notes, and interactive states work offline in guest mode, or automatically sync when you sign in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Lesson Trajectory Showcase */}
      <section className="landing-trajectory-section">
        <div className="landing-trajectory-inner">
          <div className="landing-trajectory-header">
            <div>
              <span className="landing-section-eyebrow">CURRICULUM PREVIEW</span>
              <h2 className="landing-section-title">From foundational calculus to attention layers.</h2>
            </div>
            <Link to="/curriculum" className="landing-outline-btn">
              Explore All {lessons.length} Lessons <ArrowRight size={14} />
            </Link>
          </div>

          <div className="landing-trajectory-grid">
            {lessons.slice(0, 4).map((lesson) => (
              <Link
                key={lesson.slug}
                to={`/lesson/${lesson.slug}`}
                className="landing-trajectory-card"
              >
                <div className="trajectory-top">
                  <span className="trajectory-num">{lesson.number}</span>
                  <span className="trajectory-module">{lesson.module}</span>
                </div>
                <h4>{lesson.title}</h4>
                <p>{lesson.description}</p>
                <div className="trajectory-foot">
                  <span>{lesson.estimatedMinutes} min read</span>
                  <ArrowRight size={13} className="trajectory-arrow" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal Footer with lots of breathing room */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="brand-name">
              deep<span>nova</span>
            </span>
            <p>Learn by understanding. Made for the long way in.</p>
          </div>

          <div className="landing-footer-links">
            <Link to="/curriculum">Curriculum</Link>
            <Link to="/playground">Playground</Link>
            <Link to="/interviews">Interview Prep</Link>
            <Link to="/overview">Launch Studio</Link>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© DeepNova Studio. Open learning environment.</span>
          <span>Field Notes 01</span>
        </div>
      </footer>
    </div>
  )
}
