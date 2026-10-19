import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Command, Compass, FlaskConical, GraduationCap, Layers3, Menu, Moon, Search, Sun, X, Code2, Sparkles } from 'lucide-react'
import { lessons } from './content/lessons'
import { LearningProvider } from './state'
import { Dashboard, Curriculum, LessonPage, Playground, SearchPage, ProjectsPage, InterviewPage, RevisionPage } from './pages'

function App() {
  return <LearningProvider><BrowserRouter><AppFrame /></BrowserRouter></LearningProvider>
}

function AppFrame() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('mlverse-theme') === 'dark' ? 'dark' : 'light')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('mlverse-theme', theme)
  }, [theme])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen((open) => !open) }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { setMenuOpen(false); window.scrollTo({ top: 0 }) }, [location.pathname])
  const openLesson = (slug: string) => { navigate(`/lesson/${slug}`); setSearchOpen(false) }
  return <div className="app-frame">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand"><span className="brand-mark"><Layers3 size={18} /></span><span className="brand-name">ml<span>verse</span></span><span className="brand-edition">FIELD NOTES 01</span></Link>
      <button className="workspace-switch" onClick={() => setSearchOpen(true)}><span className="workspace-avatar">M</span><span><b>My learning</b><small>Personal workspace</small></span><span className="workspace-caret">⌄</span></button>
      <div className="nav-label">LEARN</div>
      <nav className="primary-nav" aria-label="Main navigation">
        <SidebarLink to="/" icon={<Compass size={17} />} label="Overview" />
        <SidebarLink to="/curriculum" icon={<BookOpen size={17} />} label="Curriculum" />
        <SidebarLink to="/playground" icon={<FlaskConical size={17} />} label="Playground" />
        <SidebarLink to="/projects" icon={<Code2 size={17} />} label="Projects" />
        <SidebarLink to="/interviews" icon={<GraduationCap size={17} />} label="Interview prep" />
        <SidebarLink to="/revision" icon={<Sparkles size={17} />} label="Revision" />
      </nav>
      <div className="nav-label course-label">YOUR COURSE <span>+</span></div>
      <div className="course-links">{lessons.slice(0, 4).map((lesson, index) => <Link to={`/lesson/${lesson.slug}`} className="course-link" key={lesson.slug}><span className={`course-dot dot-${index + 1}`} />{lesson.title}<span className="course-count">{lesson.number}</span></Link>)}</div>
      <div className="sidebar-spacer" />
      <div className="sidebar-footnote"><span>✳</span> Built for curious minds.</div>
      <div className="sidebar-profile"><span className="profile-avatar">L</span><span><b>Learner</b><small>Local progress</small></span><button aria-label="Toggle color theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>MLVERSE</span><span>/</span><b>LEARNING STUDIO</b></div><button className="global-search" onClick={() => setSearchOpen(true)}><Search size={16} /><span>Search lessons, ideas...</span><kbd><Command size={11} /> K</kbd></button><button className="top-theme icon-button" aria-label="Toggle color theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><span className="top-avatar">L</span></header>
      <Routes><Route path="/" element={<Dashboard />} /><Route path="/curriculum" element={<Curriculum />} /><Route path="/lesson/:slug" element={<LessonPage />} /><Route path="/playground" element={<Playground />} /><Route path="/search" element={<SearchPage />} /><Route path="/projects" element={<ProjectsPage />} /><Route path="/interviews" element={<InterviewPage />} /><Route path="/revision" element={<RevisionPage />} /><Route path="*" element={<Dashboard />} /></Routes>
      <footer className="app-footer"><span>MLVERSE <i>·</i> Learn by understanding</span><span>Made for the long way in.</span></footer>
    </main>
    {searchOpen && <CommandSearch close={() => setSearchOpen(false)} openLesson={openLesson} />}
  </div>
}

function SidebarLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>{icon}<span>{label}</span>{label === 'Playground' && <small>NEW</small>}</NavLink>
}

function CommandSearch({ close, openLesson }: { close: () => void; openLesson: (slug: string) => void }) {
  const [query, setQuery] = useState('')
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const results = lessons.filter((lesson) => terms.every((term) => `${lesson.title} ${lesson.description} ${lesson.module} ${lesson.intro}`.toLowerCase().includes(term))).slice(0, 6)
  return <div className="command-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search lessons"><div className="command-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons and concepts..." /><button onClick={close} aria-label="Close search"><X size={15} /></button></div><div className="command-results"><span className="command-section-label">{query ? 'MATCHING LESSONS' : 'START EXPLORING'}</span>{results.map((lesson) => <button key={lesson.slug} onClick={() => openLesson(lesson.slug)}><span className="command-result-icon"><BookOpen size={15} /></span><span><b>{lesson.title}</b><small>{lesson.module} · {lesson.estimatedMinutes} min</small></span><ArrowRight size={15} /></button>)}{!results.length && <p className="command-empty">No matches yet. Try a different phrase.</p>}</div><div className="command-footer"><span><kbd>ESC</kbd> to close</span><Link to="/search" onClick={close}>Advanced search <ArrowRight size={13} /></Link></div></section></div>
}

export default App
