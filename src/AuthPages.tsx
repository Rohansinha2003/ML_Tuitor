import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { ApiError } from './api'
import { PageIntro } from './pages'
import { useAuth } from './AuthProvider'

function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="page-content auth-page"><PageIntro eyebrow={eyebrow} title={title} description={description} /><section className="auth-panel">{children}</section></div>
}

function FormMessage({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null
  return <div className={`auth-message ${success ? 'auth-message-success' : 'auth-message-error'}`} role={success ? 'status' : 'alert'}>{message}</div>
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="auth-spinner" />}{children}</button>
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'The request could not be completed. Please try again.'
}

export function LoginPage() {
  const { status, login } = useAuth()
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const destination = search.get('returnTo') ?? (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
  if (status === 'authenticated') return <Navigate to={destination.startsWith('/') ? destination : '/'} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await login(email, password); navigate(destination.startsWith('/') ? destination : '/', { replace: true }) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <AuthShell eyebrow="WELCOME BACK" title="Sign in to your learning space." description="Your lessons, notes, and progress stay with your account across devices.">
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <FormMessage message={error} />
      <SubmitButton busy={busy}>Sign in <ArrowRight size={15} /></SubmitButton>
      <div className="auth-links"><Link to="/forgot-password">Forgot password?</Link><span>New here? <Link to="/signup">Create an account</Link></span></div>
    </form>
  </AuthShell>
}

export function SignupPage() {
  const { status, signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  if (status === 'authenticated') return <Navigate to="/" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setSuccess(false)
    try {
      const result = await signup(name, email, password, confirmPassword)
      if (result.requiresEmailVerification) {
        setSuccess(true)
        setMessage('Check your email for a verification link before signing in.')
      } else navigate('/', { replace: true })
    } catch (reason) { setMessage(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <AuthShell eyebrow="START LEARNING" title="Make this space yours." description="Create an account to keep your progress, bookmarks, and notes across devices.">
    <form className="auth-form" onSubmit={submit}>
      <label>Full name<input autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>
      <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      <FormMessage message={message} success={success} />
      <SubmitButton busy={busy}>Create account <ArrowRight size={15} /></SubmitButton>
      <div className="auth-links"><span>Already registered? <Link to="/login">Sign in</Link></span></div>
    </form>
  </AuthShell>
}

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { setMessage(await forgotPassword(email)) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Reset your password." description="If the email is registered, we’ll send a single-use reset link.">
    <form className="auth-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><FormMessage message={error} /><FormMessage message={message} success /><SubmitButton busy={busy}>Send reset link <ArrowRight size={15} /></SubmitButton><div className="auth-links"><Link to="/login"><ArrowLeft size={13} /> Back to sign in</Link></div></form>
  </AuthShell>
}

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [search] = useSearchParams()
  const token = search.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await resetPassword(token, password, confirmPassword); setComplete(true); setMessage('Password reset. You can now sign in.') }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Choose a new password." description="Reset links are single-use and expire after 30 minutes.">
    {complete ? <div className="auth-complete"><CheckCircle2 size={22} /><FormMessage message={message} success /><Link to="/login" className="button button-dark">Go to sign in <ArrowRight size={15} /></Link></div> : <form className="auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><FormMessage message={error} /><SubmitButton busy={busy}>Reset password <ArrowRight size={15} /></SubmitButton></form>}
  </AuthShell>
}

export function VerifyEmailPage() {
  const { verifyEmail } = useAuth()
  const [search] = useSearchParams()
  const token = search.get('token') ?? ''
  const [message, setMessage] = useState('Verifying your email…')
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void verifyEmail(token).then(() => { if (active) setMessage('Email verified. You can now sign in.') }).catch((reason) => { if (active) { setError(true); setMessage(errorMessage(reason)) } })
    return () => { active = false }
  }, [token, verifyEmail])
  return <AuthShell eyebrow="EMAIL VERIFICATION" title="Confirm your email." description="Verification links are single-use and expire after 24 hours."><div className="auth-complete"><CheckCircle2 size={22} /><FormMessage message={message} success={!error} />{!error && <Link to="/login" className="button button-dark">Go to sign in <ArrowRight size={15} /></Link>}</div></AuthShell>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <div className="page-content auth-loading" role="status"><LoaderCircle size={18} className="auth-spinner" /> Restoring your session…</div>
  if (auth.status !== 'authenticated') return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

export function ProfilePage() {
  const { user, logout, changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    try { await changePassword(currentPassword, password, confirmPassword); setMessage('Password changed. Sign in again on this device.') }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  if (!user) return null
  return <div className="page-content"><PageIntro eyebrow="YOUR ACCOUNT" title="Profile and security." description="Your account details and password controls." /><section className="auth-panel profile-panel"><dl><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Email status</dt><dd>{user.emailVerified ? 'Verified' : 'Not verified'}</dd></div><div><dt>Member since</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd></div></dl><form className="auth-form" onSubmit={submit}><h2>Change password</h2><label>Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><FormMessage message={error} /><FormMessage message={message} success /><SubmitButton busy={busy}>Change password</SubmitButton></form><button className="profile-logout" type="button" onClick={() => void logout()}>Sign out</button></section></div>
}
