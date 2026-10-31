import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Code2, Copy, FlaskConical, GraduationCap, Lightbulb, ListChecks, Play, Search, Sparkles, Target } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { lessonSearchText, lessons, modules, type Lesson } from './content/lessons'
import { getStreak, useLearning } from './state'

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export function Dashboard() {
  const { state, recordActivity } = useLearning()
  const navigate = useNavigate()
  const next = lessons.find((lesson) => lesson.slug === state.lastLesson) ?? lessons[0]
  const completedSlugs = new Set(state.completed)
  const completeCount = lessons.filter((lesson) => completedSlugs.has(lesson.slug)).length
  const percent = Math.round(completeCount / lessons.length * 100)
  const streak = getStreak(state.activity)
  return <div className="page-content dashboard-page">
    <div className="welcome-line"><span>YOUR LEARNING SPACE</span><i /><span>START WHERE YOU ARE</span></div>
    <section className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><span>✳</span> A BETTER WAY TO LEARN AI</div><h1>Understand AI.<br /><em>Don’t just memorize it.</em></h1><p>Build real intuition for the ideas behind machine learning, one small experiment at a time.</p><div className="hero-actions"><button className="button button-dark" onClick={() => { recordActivity(); navigate(`/lesson/${next.slug}`) }}>Continue learning <ArrowRight size={16} /></button><Link className="text-link" to="/curriculum">Explore the roadmap <ArrowUpRight size={15} /></Link></div></div><div className="hero-art"><div className="art-label art-label-top">A MODEL, LEARNING</div><div className="art-grid" /><svg viewBox="0 0 350 220" role="img" aria-label="A fitted line through observed data points"><path className="art-ghost-line" d="M32 186 C88 120 117 120 157 102 S228 101 315 71" /><path className="art-fit-line" d="M32 171 C88 151 109 131 152 116 S224 86 315 43" />{[[50,160],[84,149],[111,127],[140,126],[164,104],[192,110],[224,75],[263,71],[296,54]].map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4.3" className="data-dot" />)}<circle cx="224" cy="75" r="9" className="selected-ring" /></svg><div className="art-label art-label-bottom">FEATURE <b>01</b><span>REGRESSION</span></div><div className="art-equation">y = <b>w</b>x + <b>b</b></div></div><div className="hero-index">01 <span>/ 08</span></div></section>
    <section className="metrics-row"><Metric label="COURSE PROGRESS" value={`${percent}%`} detail={`${completeCount} of ${lessons.length} lessons`} icon={<Target size={17} />} /><Metric label="LEARNING STREAK" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} detail={state.activity.length ? 'Keep the thread going' : 'A fresh start today'} icon={<span>↗</span>} /><Metric label="SAVED FOR LATER" value={String(state.bookmarks.length).padStart(2, '0')} detail="Lessons in your library" icon={<Bookmark size={16} />} /><Metric label="LESSONS FINISHED" value={String(completeCount).padStart(2, '0')} detail="At your own pace" icon={<CheckCircle2 size={17} />} /></section>
    <div className="dashboard-columns"><section><SectionTitle eyebrow="PICK UP THE THREAD" title="Continue learning" link="/curriculum" linkText="All lessons" /><Link to={`/lesson/${next.slug}`} className="continue-card"><div className="continue-art"><span>{next.number}</span><small>LESSON<br />{next.number}</small><i /><i /></div><div className="continue-info"><div className="lesson-meta">{next.module} <i>·</i> {next.estimatedMinutes} MIN</div><h3>{next.title}</h3><p>{next.description}</p><div className="continue-bottom"><span className="progress-inline"><i style={{ width: `${state.completed.includes(next.slug) ? 100 : 22}%` }} /></span><span>{state.completed.includes(next.slug) ? 'Complete' : 'In progress'}</span><ArrowRight size={17} /></div></div></Link></section>
      <section><SectionTitle eyebrow="THE BIG PICTURE" title="Your learning path" link="/curriculum" linkText="View roadmap" /><div className="roadmap-card">{modules.slice(0, 4).map((item, index) => { const done = item.lessonSlugs.length > 0 && item.lessonSlugs.every((slug) => completedSlugs.has(slug)); const started = item.lessonSlugs.some((slug) => completedSlugs.has(slug)); return <Link to={item.lessonSlugs[0] ? `/lesson/${item.lessonSlugs[0]}` : '/curriculum'} className="roadmap-step" key={item.id} aria-label={item.lessonSlugs.length ? `Open ${item.shortTitle} lessons` : `Browse roadmap for ${item.shortTitle}`}><span className={`step-node ${done ? 'step-done' : ''}`}>{done ? <Check size={12} /> : item.number}</span><span className="step-info"><b>{item.shortTitle}</b><small>{item.level} · {item.lessonCount} lessons</small></span><span className="step-status">{done ? 'DONE' : started ? 'STARTED' : index === 0 ? 'IN PROGRESS' : 'UP NEXT'}</span></Link>})}<Link to="/curriculum" className="roadmap-more">EXPLORE THE FULL ROADMAP <ArrowRight size={13} /></Link></div></section></div>
    <section className="featured-section"><SectionTitle eyebrow="A GOOD PLACE TO BEGIN" title="Made for your next question" link="/curriculum" linkText="Browse curriculum" /><div className="featured-grid">{lessons.slice(0, 3).map((lesson, index) => <LessonTile lesson={lesson} index={index} key={lesson.slug} completed={state.completed.includes(lesson.slug)} />)}</div></section>
    {state.bookmarks.length > 0 && <section className="saved-section"><SectionTitle eyebrow="YOUR LIBRARY" title="Saved for later" link="/revision" linkText="Revision mode" /><div className="saved-row">{state.bookmarks.map((slug) => { const lesson = lessons.find((item) => item.slug === slug); return lesson ? <Link key={slug} to={`/lesson/${slug}`}><Bookmark size={14} />{lesson.title}<ArrowRight size={14} /></Link> : null })}</div></section>}
  </div>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="metric"><span className="metric-icon">{icon}</span><div><span>{label}</span><b>{value}</b><small>{detail}</small></div></div>
}

function SectionTitle({ eyebrow, title, link, linkText }: { eyebrow: string; title: string; link: string; linkText: string }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><Link to={link} className="small-link">{linkText}<ArrowRight size={14} /></Link></div>
}

function LessonTile({ lesson, index, completed }: { lesson: Lesson; index: number; completed: boolean }) {
  return <Link to={`/lesson/${lesson.slug}`} className={`lesson-tile tile-${index + 1}`}><div className="tile-top"><span>{lesson.module}</span>{completed ? <CheckCircle2 size={16} /> : <ArrowUpRight size={16} />}</div><div className="tile-number">{lesson.number}</div><h3>{lesson.title}</h3><p>{lesson.description}</p><div className="tile-foot"><span>{lesson.difficulty}</span><span>{lesson.estimatedMinutes} min read</span></div></Link>
}

export function Curriculum() {
  const [filter, setFilter] = useState('All levels')
  const { state } = useLearning()
  const filtered = modules.filter((item) => filter === 'All levels' || item.level === filter)
  return <div className="page-content"><PageIntro eyebrow="THE LEARNING MAP" title="A path, not a pile of topics." description="Move from first principles to the systems shaping modern AI. Take the route that makes sense for you." action={<span className="content-counter">{lessons.length} PUBLISHED LESSONS</span>} /><div className="filter-row"><div className="segmented-control" role="group" aria-label="Filter curriculum by difficulty">{['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((level) => <button key={level} type="button" aria-pressed={filter === level} className={filter === level ? 'segment-active' : ''} onClick={() => setFilter(level)}>{level}</button>)}</div><span className="roadmap-legend"><i className="legend-ready" /> Published <i className="legend-soon" /> In the roadmap</span></div><div className="curriculum-list">{filtered.map((item, index) => { const done = item.lessonSlugs.filter((slug) => state.completed.includes(slug)).length; const progressLabel = item.lessonSlugs.length ? `${done} / ${item.lessonSlugs.length} COMPLETE` : `${item.lessonCount} LESSONS PLANNED`; return <section className="module-row" key={item.id}><div className={`module-index module-${index % 4}`}><span>{item.number}</span><b>{['◉', '↗', '∿', '⌁'][index % 4]}</b></div><div className="module-main"><div className="module-topline"><span>{item.level.toUpperCase()} <i>·</i> {item.estimatedHours}</span><span>{progressLabel}</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="module-outcomes">{item.outcomes.map((outcome) => <span key={outcome}>{outcome}</span>)}</div><div className="module-lesson-list">{item.lessonSlugs.map((slug) => { const lesson = lessons.find((entry) => entry.slug === slug); if (!lesson) return null; return <Link key={slug} to={`/lesson/${slug}`} className="module-lesson"><span className={`lesson-state ${state.completed.includes(slug) ? 'lesson-state-done' : ''}`}>{state.completed.includes(slug) ? <Check size={11} /> : <Play size={10} />}</span><span>{lesson.title}</span><span className="lesson-duration">{lesson.estimatedMinutes} min</span><ArrowRight size={14} /></Link> })}{item.lessonSlugs.length < item.lessonCount && <div className="module-coming"><span className="lesson-state">·</span><span>{item.lessonCount - item.lessonSlugs.length} more lessons planned</span><small>IN THE ROADMAP</small></div>}</div></div></section>})}</div></div>
}

export function LessonPage() {
  const { slug = lessons[0].slug } = useParams()
  const { state, complete, bookmark, visit, saveNote } = useLearning()
  const [choice, setChoice] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeToc, setActiveToc] = useState('The idea')
  const lesson = lessons.find((item) => item.slug === slug)
  const index = lesson ? lessons.findIndex((item) => item.slug === lesson.slug) : -1
  const module = lesson ? modules.find((item) => item.lessonSlugs.includes(lesson.slug)) : undefined
  const moduleSlugs = module?.lessonSlugs ?? (lesson ? lessons.filter((item) => item.module === lesson.module).map((item) => item.slug) : [])
  const moduleCompleted = moduleSlugs.filter((itemSlug) => state.completed.includes(itemSlug)).length
  const moduleProgress = moduleSlugs.length ? Math.round(moduleCompleted / moduleSlugs.length * 100) : 0
  const done = Boolean(lesson && state.completed.includes(lesson.slug))
  const saved = Boolean(lesson && state.bookmarks.includes(lesson.slug))
  useEffect(() => { if (lesson) { visit(lesson.slug); setChoice(null); window.scrollTo({ top: 0 }) } }, [lesson, visit])
  const copyCode = async () => { await navigator.clipboard.writeText(lesson.code); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  if (!lesson) return <NotFoundPage title="Lesson not found" description="That lesson address does not match a published lesson. Browse the curriculum to find an available topic." />
  const sectionIds = ['the-idea', ...lesson.sections.map((section) => section.title.toLowerCase().replaceAll(' ', '-')), 'in-python', 'try-these-on-for-size', 'one-minute-check']
  const tocItems = ['The idea', ...lesson.sections.map((section) => section.title), 'In Python', 'Try these on for size', 'One-minute check']
  const previousLesson = lessons[Math.max(0, index - 1)]
  const nextLesson = lessons[Math.min(lessons.length - 1, index + 1)]
  const previousDisabled = index === 0
  const nextDisabled = index === lessons.length - 1
  return <div className="lesson-layout"><aside className="lesson-rail"><div className="rail-heading"><Link to="/curriculum"><ArrowLeft size={14} /> CURRICULUM</Link><span>{lesson.module}</span></div><div className="rail-progress"><div><span>MODULE PROGRESS</span><b>{moduleProgress}%</b></div><span className="rail-track"><i style={{ width: `${moduleProgress}%` }} /></span></div><div className="rail-lessons"><span className="rail-group-title">{lesson.module.toUpperCase()}</span>{lessons.filter((item) => item.module === lesson.module).map((item) => <Link to={`/lesson/${item.slug}`} key={item.slug} className={`rail-lesson ${item.slug === lesson.slug ? 'rail-lesson-active' : ''}`}><span className={`rail-lesson-state ${state.completed.includes(item.slug) ? 'rail-lesson-done' : ''}`}>{state.completed.includes(item.slug) ? <Check size={11} /> : item.number}</span><span>{item.title}</span>{item.slug === lesson.slug && <i />}</Link>)}</div><div className="rail-foot">{lesson.estimatedMinutes} MIN READ <i>·</i> {lesson.difficulty.toUpperCase()}</div></aside>
    <article className="lesson-article"><div className="lesson-crumb"><Link to="/curriculum">CURRICULUM</Link><span>/</span><span>{lesson.module.toUpperCase()}</span><span>/</span><span>LESSON {lesson.number}</span></div><div className="lesson-heading"><div className="lesson-heading-meta"><span className="level-pill">{lesson.difficulty}</span><span>{lesson.estimatedMinutes} MIN</span><span>FIELD NOTES 01</span></div><h1>{lesson.title}</h1><p className="lesson-deck">{lesson.description}</p><div className="lesson-heading-actions"><button className={`bookmark-button ${saved ? 'bookmarked' : ''}`} onClick={() => bookmark(lesson.slug)}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save lesson'}</button><i /><button className={`complete-button ${done ? 'complete-done' : ''}`} onClick={() => complete(lesson.slug)}>{done ? <CheckCircle2 size={15} /> : <Check size={15} />}{done ? 'Completed' : 'Mark complete'}</button></div></div>
      <div className="lesson-note"><span><Lightbulb size={17} /></span><div><b>Start with an analogy</b><p>{lesson.analogy}</p></div></div><section className="lesson-objectives" aria-label="Lesson objectives"><div><span>WHAT YOU WILL LEARN</span><ul>{lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></div>{lesson.prerequisites.length > 0 && <div className="prerequisite-list"><span>PREREQUISITES</span><div>{lesson.prerequisites.map((slug) => { const prerequisite = lessons.find((item) => item.slug === slug); return prerequisite ? <Link key={slug} to={`/lesson/${slug}`}>{prerequisite.title}<ArrowRight size={12} /></Link> : null })}</div></div>}</section><LessonProse title="The idea" body={lesson.intro} id="the-idea" />{lesson.sections.map((section, sectionIndex) => <LessonProse title={section.title} body={section.body} kicker={section.kicker} points={section.points} example={section.example} id={sectionIds[sectionIndex + 1]} key={section.title} />)}
      <div className="lesson-formula"><span>THE SHORT VERSION</span><div dangerouslySetInnerHTML={{ __html: katex.renderToString(lesson.formula, { throwOnError: false, displayMode: true }) }} /><p>{lesson.formulaExplanation}</p></div>
      <section className="lesson-code-section" id="in-python"><SectionHeading kicker="IN PYTHON" title="Make it concrete" icon={<Code2 size={15} />} /><div className="code-window"><div className="code-window-head"><span><i /><i /><i /></span><small>python · example</small><button onClick={copyCode}><Copy size={13} />{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{lesson.code}</code></pre></div>{lesson.codeOutput && <div className="code-output"><b>EXPECTED OUTPUT</b><pre>{lesson.codeOutput}</pre></div>}<div className="code-walkthrough"><b>What to notice</b><p>{lesson.codeExplanation}</p></div></section>
      <section className="practice-section" id="try-these-on-for-size"><SectionHeading kicker="CHECK YOUR INTUITION" title="Try these on for size" icon={<ListChecks size={15} />} /><div className="practice-list">{lesson.practice.map((item, itemIndex) => <details className="practice-item" key={item.prompt}><summary><span>{String(itemIndex + 1).padStart(2, '0')}</span>{item.prompt}<ChevronDown size={15} /></summary><div><b>Short answer</b><p>{item.answer}</p>{item.solution && <><b>Step-by-step solution</b><p>{item.solution}</p></>}</div></details>)}</div></section>
      <section className="quiz-section" id="one-minute-check"><div className="quiz-kicker"><Sparkles size={14} /> ONE-MINUTE CHECK</div><h2>{lesson.quiz.question}</h2><div className="quiz-options" role="group" aria-label="Choose a quiz answer">{lesson.quiz.options.map((option, optionIndex) => <button key={option} type="button" aria-pressed={choice === optionIndex} onClick={() => setChoice(optionIndex)} className={`quiz-option ${choice === optionIndex ? optionIndex === lesson.quiz.answer ? 'quiz-correct' : 'quiz-incorrect' : ''} ${choice !== null && optionIndex === lesson.quiz.answer ? 'quiz-reveal' : ''}`}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}{choice === optionIndex && (optionIndex === lesson.quiz.answer ? <Check size={15} /> : <span>×</span>)}</button>)}</div>{choice !== null && <div className={`quiz-feedback ${choice === lesson.quiz.answer ? 'feedback-correct' : 'feedback-incorrect'}`} aria-live="polite"><b>{choice === lesson.quiz.answer ? 'That’s it.' : 'Not quite, and that’s useful.'}</b><p>{lesson.quiz.explanation}</p></div>}</section>
      {lesson.miniProject && <section className="mini-project"><div><span className="section-kicker">MINI PROJECT</span><h2>{lesson.miniProject.title}</h2><p>{lesson.miniProject.objective}</p></div><ol>{lesson.miniProject.tasks.map((task) => <li key={task}>{task}</li>)}</ol><div className="mini-project-extension"><b>Try next</b><span>{lesson.miniProject.extension}</span></div></section>}
      <section className="takeaways"><div><span className="section-kicker">KEEP THESE CLOSE</span><h2>Three things to remember</h2></div><ul>{lesson.takeaways.map((item) => <li key={item}><span><Check size={12} /></span>{item}</li>)}</ul></section><section className="interview-card"><span><GraduationCap size={17} /></span><div><span className="section-kicker">INTERVIEW CORNER</span><h3>{lesson.interview.question}</h3><details><summary>Unpack the answer <ChevronDown size={13} /></summary><p>{lesson.interview.answer}</p></details></div></section>
      <section className="lesson-notes"><label htmlFor="lesson-note">YOUR NOTES <small>SAVED ON THIS DEVICE</small></label><textarea id="lesson-note" value={state.notes[lesson.slug] ?? ''} onChange={(event) => saveNote(lesson.slug, event.target.value)} placeholder="Write down the part you want to remember..." /></section>
      <div className="lesson-pagination"><Link to={`/lesson/${previousLesson.slug}`} aria-disabled={previousDisabled} tabIndex={previousDisabled ? -1 : undefined} onClick={(event) => { if (previousDisabled) event.preventDefault() }}><ChevronLeft size={15} /><span><small>PREVIOUS LESSON</small><b>{previousLesson.title}</b></span></Link><Link className="pagination-next" to={`/lesson/${nextLesson.slug}`} aria-disabled={nextDisabled} tabIndex={nextDisabled ? -1 : undefined} onClick={(event) => { if (nextDisabled) event.preventDefault() }}><span><small>NEXT LESSON</small><b>{nextLesson.title}</b></span><ChevronRight size={15} /></Link></div>
    </article><aside className="lesson-toc"><span>ON THIS PAGE</span>{tocItems.map((item, itemIndex) => <button key={item} className={activeToc === item ? 'toc-active' : ''} onClick={() => { setActiveToc(item); document.getElementById(sectionIds[itemIndex])?.scrollIntoView({ behavior: 'smooth' }) }}>{item}</button>)}<div className="toc-note"><Lightbulb size={15} /><p>One idea understood deeply beats ten skimmed.</p></div></aside></div>
}

function SectionHeading({ kicker, title, icon }: { kicker: string; title: string; icon: React.ReactNode }) {
  return <div className="content-section-heading"><span>{icon}</span><div><small>{kicker}</small><h2>{title}</h2></div></div>
}

function LessonProse({ title, body, kicker = 'BUILD YOUR INTUITION', points, example, id }: { title: string; body: string; kicker?: string; points?: string[]; example?: string; id: string }) {
  return <section className="lesson-prose" id={id}><SectionHeading kicker={kicker} title={title} icon={<Sparkles size={15} />} /><p>{body}</p>{points && <ul className="section-points">{points.map((point) => <li key={point}><i />{point}</li>)}</ul>}{example && <div className="worked-example"><span>WORKED EXAMPLE</span><p>{example}</p></div>}</section>
}

export function Playground() {
  const [slope, setSlope] = useState(1.15)
  const [intercept, setIntercept] = useState(0.4)
  const [tab, setTab] = useState<'regression' | 'descent'>('regression')
  const points = [{ x: 0.5, y: 1.7 }, { x: 1.2, y: 2.2 }, { x: 1.9, y: 2.9 }, { x: 2.7, y: 3.1 }, { x: 3.3, y: 4.1 }, { x: 4.1, y: 4.5 }, { x: 4.8, y: 5.7 }, { x: 5.6, y: 5.6 }, { x: 6.3, y: 6.9 }, { x: 7.2, y: 7.2 }]
  const line = Array.from({ length: 33 }, (_, index) => ({ x: index / 4, y: slope * index / 4 + intercept }))
  const error = (points.reduce((sum, point) => sum + (point.y - slope * point.x - intercept) ** 2, 0) / points.length).toFixed(2)
  const losses = useMemo(() => Array.from({ length: 16 }, (_, epoch) => {
    const loss = 3.8 * Math.exp(-epoch * (0.1 + Math.min(0.98, slope / 5) * 0.12))
    return { step: epoch, loss: Number(loss.toFixed(3)) }
  }), [slope])
  return <div className="page-content playground-page"><PageIntro eyebrow="THE VISUAL LAB" title="Learn by turning the knobs." description="A model is easier to understand when you can see what it changes. Start with the simplest useful one: a line." /><div className="playground-tabs"><button className={tab === 'regression' ? 'tab-active' : ''} onClick={() => setTab('regression')}>Linear regression</button><button className={tab === 'descent' ? 'tab-active' : ''} onClick={() => setTab('descent')}>Gradient descent</button></div><div className="playground-workspace"><div className="playground-chart"><div className="playground-chart-head"><div><small>{tab === 'regression' ? 'FIT A LINE' : 'WATCH IT LEARN'}</small><h2>{tab === 'regression' ? 'What does a good fit look like?' : 'How quickly can we find it?'}</h2></div><span className="chart-live"><i /> LIVE</span></div><div className="chart-legend"><span><i />{tab === 'regression' ? 'Observed examples' : 'Training loss'}</span><span>{tab === 'regression' ? 'YOUR MODEL' : `LEARNING RATE ${Math.min(0.99, slope / 5).toFixed(2)}`}</span></div><div className="chart-wrap">{tab === 'regression' ? <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} /><XAxis type="number" dataKey="x" domain={[0, 8]} tickLine={false} axisLine={false} /><YAxis type="number" dataKey="y" domain={[0, 9]} tickLine={false} axisLine={false} /><Tooltip /><Scatter data={points} fill="var(--chart-point)" /><Line data={line} dataKey="y" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} /></ScatterChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><LineChart data={losses} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} /><XAxis dataKey="step" tickLine={false} axisLine={false} /><YAxis domain={[0, 4]} tickLine={false} axisLine={false} /><Tooltip /><ReferenceLine y={0.2} stroke="var(--chart-muted)" strokeDasharray="4 4" /><Line dataKey="loss" stroke="var(--chart-line)" strokeWidth={2.4} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>}</div><div className="chart-axis-labels"><span>{tab === 'regression' ? 'HOURS OF PRACTICE →' : 'TRAINING STEPS →'}</span><span>{tab === 'regression' ? `MEAN SQUARED ERROR  ${error}` : `FINAL LOSS  ${losses[15].loss}`}</span></div></div><aside className="playground-controls"><div className="control-heading"><span><FlaskConical size={17} /></span><div><b>Model controls</b><small>Small changes, visible effects.</small></div></div><Slider label={tab === 'regression' ? 'Slope · w' : 'Learning rate'} value={slope} display={tab === 'regression' ? slope.toFixed(2) : Math.min(0.99, slope / 5).toFixed(2)} min={tab === 'regression' ? -1 : 0.1} max={tab === 'regression' ? 2 : 4.9} step={0.05} change={setSlope} />{tab === 'regression' && <Slider label="Intercept · b" value={intercept} display={intercept.toFixed(2)} min={-2} max={3} step={0.05} change={setIntercept} />}<div className="live-equation">{tab === 'regression' ? <>ŷ = <b>{slope.toFixed(2)}</b>x + <b>{intercept.toFixed(2)}</b></> : <>θ<sub>new</sub> = θ − α∇J(θ)</>}</div><p>{tab === 'regression' ? 'Adjust slope and intercept. The line responds, and mean squared error updates as you move.' : 'A smaller learning rate makes smaller steps. Watch the loss change as the rate moves.'}</p><button className="reset-controls" onClick={() => { setSlope(1.15); setIntercept(0.4) }}>Reset controls</button></aside></div><div className="playground-explainer"><Lightbulb size={16} /><div><b>What’s happening here?</b><p>{tab === 'regression' ? 'Each dot is an observed example. The line makes a prediction for every dot. Mean squared error measures the average squared distance between predictions and observations.' : 'Gradient descent updates model parameters in the direction that reduces loss. Steps that are too small are slow; steps that are too large may overshoot.'}<br /><Link to={`/lesson/${tab === 'regression' ? 'linear-regression' : 'gradient-descent'}`}>Read the full lesson <ArrowRight size={13} /></Link></p></div></div></div>
}

function Slider({ label, value, display, min, max, step, change }: { label: string; value: number; display: string; min: number; max: number; step: number; change: (value: number) => void }) {
  return <label className="slider-control"><span><b>{label}</b><output>{display}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => change(Number(event.target.value))} /></label>
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('All levels')
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const results = lessons.filter((lesson) => (level === 'All levels' || lesson.difficulty === level) && terms.every((term) => lessonSearchText(lesson).includes(term)))
  return <div className="page-content search-page"><PageIntro eyebrow="THE KNOWLEDGE INDEX" title="Find the idea you need." description="Search lessons, concepts, and the questions that connect them." /><label className="search-page-box"><Search size={20} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “gradient descent” or “overfitting”" /></label><div className="search-filters" role="group" aria-label="Filter search results by difficulty">{['All levels', 'Beginner', 'Intermediate', 'Advanced'].map((item) => <button type="button" aria-pressed={level === item} className={level === item ? 'filter-active' : ''} onClick={() => setLevel(item)} key={item}>{item}</button>)}<span aria-live="polite">{results.length} lessons</span></div>{results.length ? <div className="search-results">{results.map((lesson, index) => <LessonTile lesson={lesson} index={index % 3} completed={false} key={lesson.slug} />)}</div> : <div className="empty-state"><span><Search size={21} /></span><h2>No matching ideas yet.</h2><p>Try a broader term, or browse the curriculum for planned topics.</p><Link to="/curriculum" className="text-link">Open the curriculum <ArrowRight size={14} /></Link></div>}</div>
}

export function NotFoundPage({ title = 'Page not found', description = 'This address does not match a page in DeepNova.' }: { title?: string; description?: string }) {
  return <div className="page-content"><PageIntro eyebrow="NOT FOUND" title={title} description={description} /><div className="empty-state"><span><Search size={21} /></span><h2>No content at this address.</h2><p>Choose a published lesson from the curriculum or return to your learning space.</p><div className="not-found-actions"><Link to="/curriculum" className="text-link">Browse curriculum <ArrowRight size={14} /></Link><Link to="/overview" className="text-link">Go to overview <ArrowRight size={14} /></Link></div></div></div>
}

export type ProjectLevel = 'BEGINNER' | 'INTERMEDIATE' | 'HARD'

export interface ProjectBrief {
  title: string
  level: ProjectLevel
  goal: string
  dataset: string
  metrics: string[]
  tags: string[]
  steps: string[]
  challenge: string
}

const projects: ProjectBrief[] = [
  // -------------------------------------------------------------
  // BEGINNER PROJECTS
  // -------------------------------------------------------------
  {
    title: 'Predict student exam performance',
    level: 'BEGINNER',
    goal: 'Estimate final course scores from study habits, attendance, and demographics. Diagnose where the model makes large errors.',
    dataset: 'UCI Student Performance Dataset (open license)',
    metrics: ['MAE (Mean Absolute Error)', 'RMSE', 'R² Score'],
    tags: ['Regression', 'EDA', 'scikit-learn', 'Baselines'],
    steps: [
      'Audit the data for missing values and collinear features.',
      'Split into 80/20 train/test sets before calculating any column statistics.',
      'Implement a simple mean baseline predictor and calculate initial baseline MAE.',
      'Fit an Ordinary Least Squares (OLS) linear regression model.',
      'Plot residual errors against predicted values to check for heteroscedasticity.',
      'Report MAE in actual grade points and write a brief reflection on model limitations.',
    ],
    challenge: 'Add L2 Ridge regularization with cross-validated alpha to see if shrinkage reduces overfitting on small test subsets.',
  },
  {
    title: 'House price valuation: baseline to regularization',
    level: 'BEGINNER',
    goal: 'Predict continuous property prices and understand how skewed distributions, log transforms, and outliers impact linear models.',
    dataset: 'Ames Housing Dataset (Kaggle / OpenML)',
    metrics: ['Log-RMSE', 'Median Absolute Error', 'Explained Variance'],
    tags: ['Regression', 'Feature Engineering', 'Regularization'],
    steps: [
      'Examine price distribution skewness and apply log1p transformation to stabilize variance.',
      'Encode categorical variables using one-hot encoding with rare category grouping.',
      'Scale numerical features using StandardScaler inside a scikit-learn Pipeline.',
      'Compare Ridge (L2) and Lasso (L1) regularization paths across varying penalty strengths.',
      'Inspect Lasso coefficients to identify which features were completely eliminated.',
      'Evaluate holdout predictions and plot top 10 most influential feature weights.',
    ],
    challenge: 'Identify the 5 largest prediction errors (outliers) and inspect why the model failed on those specific houses.',
  },
  {
    title: 'Heart disease early risk detection',
    level: 'BEGINNER',
    goal: 'Classify presence of cardiovascular disease from patient biometric data while calibrating probabilities for healthcare decision thresholds.',
    dataset: 'UCI Cleveland Heart Disease Dataset',
    metrics: ['Recall (Sensitivity)', 'ROC-AUC', 'Brier Score'],
    tags: ['Logistic Regression', 'Medical ML', 'Calibration'],
    steps: [
      'Inspect class balance and clinical feature correlations (cholesterol, resting blood pressure, max heart rate).',
      'Handle missing values using median imputation fit strictly on training splits.',
      'Train a Logistic Regression classifier and compute predicted probabilities.',
      'Plot the ROC curve and choose a classification decision threshold that favors high recall.',
      'Calibrate output probabilities using Platt scaling / Isotonic regression.',
      'Generate a clinical confusion matrix highlighting the cost of False Negatives.',
    ],
    challenge: 'Adjust the classification decision threshold from 0.5 to 0.25 to maximize sensitivity while maintaining at least 70% precision.',
  },
  {
    title: 'SMS spam & phishing message filter',
    level: 'BEGINNER',
    goal: 'Detect spam and malicious phishing SMS messages using bag-of-words tokenization, n-grams, and Multinomial Naive Bayes.',
    dataset: 'SMS Spam Collection Dataset (UCI)',
    metrics: ['Precision at 99% Recall', 'F1-Score', 'False Positive Rate'],
    tags: ['NLP', 'Naive Bayes', 'TF-IDF', 'Text Mining'],
    steps: [
      'Preprocess raw SMS text: lowercase, remove punctuation, and extract character/word length features.',
      'Build a TF-IDF vectorizer with unigrams and bigrams, stripping English stopwords.',
      'Train a Multinomial Naive Bayes model with Laplace smoothing.',
      'Inspect the top 20 words with the highest log-likelihood ratios for spam vs. ham.',
      'Test the classifier against ambiguous real-world messages with modern slang.',
      'Evaluate false positive rates to ensure non-spam messages are never discarded.',
    ],
    challenge: 'Compare Multinomial Naive Bayes against a linear SVM and inspect which tokens cause misclassifications in edge cases.',
  },

  // -------------------------------------------------------------
  // INTERMEDIATE PROJECTS
  // -------------------------------------------------------------
  {
    title: 'Customer churn signals & cost-sensitive loss',
    level: 'INTERMEDIATE',
    goal: 'Predict subscriber churn for a subscription service while optimizing a custom financial loss matrix rather than standard 0-1 accuracy.',
    dataset: 'Telco Customer Churn Dataset (IBM / Kaggle)',
    metrics: ['PR-AUC (Precision-Recall)', 'Expected Financial Value', 'F1-Macro'],
    tags: ['XGBoost', 'LightGBM', 'Cost-Sensitive', 'SHAP'],
    steps: [
      'Engineer tenure, contract duration, payment method, and monthly charge ratios.',
      'Formulate a 2x2 financial cost-benefit matrix ($cost of retention offer vs. $lost customer lifetime value).',
      'Train LightGBM and XGBoost gradient-boosted decision trees with early stopping.',
      'Perform stratified 5-fold cross-validation and optimize hyperparameters with Bayesian Search.',
      'Use SHAP (SHapley Additive exPlanations) values to explain individual customer risk drivers.',
      'Select the optimal decision threshold that maximizes total retained business revenue.',
    ],
    challenge: 'Implement an Uplift Model that predicts which customers will stay specifically because of an intervention rather than organic churn.',
  },
  {
    title: 'Credit card fraud detection with extreme imbalance',
    level: 'INTERMEDIATE',
    goal: 'Identify fraudulent card transactions where positive cases represent only 0.17% of total volume, using custom resampling and isolation forests.',
    dataset: 'European Cardholders Credit Card Fraud Dataset (Kaggle)',
    metrics: ['Average Precision (PR-AUC)', 'Recall at 95% Precision', 'Precision@K'],
    tags: ['Imbalanced Learning', 'Anomaly Detection', 'Isolation Forest'],
    steps: [
      'Explore PCA-transformed transaction features and analyze severe 578:1 class skewness.',
      'Establish why standard accuracy is completely deceptive (a dummy model gets 99.83% accuracy).',
      'Implement cost-sensitive class weights in Logistic Regression and Random Forest.',
      'Compare oversampling (SMOTE) strictly on training folds against undersampling majority classes.',
      'Train an unsupervised Isolation Forest model to detect anomalous spending vectors.',
      'Plot Precision-Recall curves to evaluate performance across the entire operating range.',
    ],
    challenge: 'Implement Focal Loss in PyTorch to dynamically down-weight the loss assigned to easy majority-class examples during training.',
  },
  {
    title: 'Chest X-ray diagnostic vision classifier',
    level: 'INTERMEDIATE',
    goal: 'Classify bacterial vs. viral pneumonia from chest radiographs using deep convolutional transfer learning and Grad-CAM interpretability.',
    dataset: 'Chest X-Ray Images Dataset (NIH / Kaggle)',
    metrics: ['ROC-AUC', 'Sensitivity / Specificity', 'Inference Latency'],
    tags: ['Computer Vision', 'PyTorch', 'Transfer Learning', 'Grad-CAM'],
    steps: [
      'Preprocess medical images: normalization, random rotations, horizontal flips, and affine transforms.',
      'Load a pre-trained ResNet-50 / EfficientNet backbone and replace the classification head.',
      'Train using a two-stage regime: freeze base layers for 5 epochs, then unfreeze and fine-tune with a low learning rate.',
      'Implement Grad-CAM to visualize activation heatmaps over lung regions on test scans.',
      'Verify whether model focus aligns with anatomical pathology or spurious edge artifacts.',
      'Export the trained model to ONNX runtime and measure inference latency on CPU vs. GPU.',
    ],
    challenge: 'Apply test-time augmentation (TTA) and measure if ensemble averaging of flipped scans boosts AUROC on difficult borderline cases.',
  },
  {
    title: 'E-commerce hybrid recommendation engine',
    level: 'INTERMEDIATE',
    goal: 'Build a two-stage recommendation pipeline: implicit feedback matrix factorization for candidate generation followed by gradient-boosted re-ranking.',
    dataset: 'MovieLens 1M / Instacart Market Basket (Open License)',
    metrics: ['Hit Rate@10', 'NDCG@10', 'Catalog Coverage'],
    tags: ['Recommender Systems', 'Matrix Factorization', 'Two-Stage Pipeline'],
    steps: [
      'Construct a sparse user-item interaction matrix from implicit click/purchase logs.',
      'Train an Alternating Least Squares (ALS) matrix factorization model to generate top-100 candidate items.',
      'Extract user features (recency, frequency, spend) and item features (category, popularity, price).',
      'Train a LightGBM ranker on candidate pairs using LambdaMART pairwise ranking objective.',
      'Evaluate offline Hit Rate@10 and Normalized Discounted Cumulative Gain (NDCG@10).',
      'Analyze diversity vs. popularity bias to ensure cold-start items receive discovery impressions.',
    ],
    challenge: 'Implement Approximate Nearest Neighbors (ANN) indexing with HNSW or Faiss to serve candidate embeddings under 5ms.',
  },

  // -------------------------------------------------------------
  // HARD / ADVANCED PROJECTS
  // -------------------------------------------------------------
  {
    title: 'Domain-adapted small LLM fine-tuning with QLoRA & DPO',
    level: 'HARD',
    goal: 'Fine-tune an open-source 3B–7B parameter LLM on technical domain data using 4-bit Quantized LoRA, followed by Direct Preference Optimization (DPO).',
    dataset: 'Domain Technical Corpus + Chosen/Rejected Preference Pairs (HuggingFace)',
    metrics: ['Perplexity (PPL)', 'Win Rate vs. Base Model', 'Hallucination Rate'],
    tags: ['GenAI', 'QLoRA', 'DPO', 'Transformers', 'PEFT', 'PyTorch'],
    steps: [
      'Format domain instructional data into chat templates with system, user, and assistant turns.',
      'Quantize the base model (e.g. Llama 3 8B or Mistral 7B) to 4-bit NormalFloat using bitsandbytes.',
      'Attach Low-Rank Adaptation (LoRA) matrices to self-attention and MLP projection layers.',
      'Execute Supervised Fine-Tuning (SFT) with cosine learning rate schedule and gradient accumulation.',
      'Curate preference pairs (chosen vs. rejected responses) and run Direct Preference Optimization (DPO).',
      'Benchmark hallucination rates and evaluate reasoning benchmarks against the un-tuned base model.',
    ],
    challenge: 'Merge LoRA adapters into the 16-bit base weights and quantize into GGUF format for local edge inference with llama.cpp.',
  },
  {
    title: 'Production-grade RAG with hybrid search & reranking',
    level: 'HARD',
    goal: 'Architect a multi-document Question-Answering system combining dense vector embeddings with sparse BM25 lexical search and cross-encoder re-ranking.',
    dataset: 'SEC 10-K Financial Filings or ArXiv AI Papers (Public Domain)',
    metrics: ['Ragas Faithfulness', 'Context Precision', 'Answer Relevancy'],
    tags: ['RAG', 'Vector Search', 'Hybrid Retrieval', 'Cross-Encoder', 'LangChain'],
    steps: [
      'Implement recursive chunking with 15% overlap respecting markdown headers and tables.',
      'Generate dense vector embeddings (e.g. BAAI/bge-large-en) and index into a vector store (Chroma/FAISS).',
      'Build a sparse BM25 index over the same chunks for exact keyword, ticker symbol, and acronym matches.',
      'Implement Reciprocal Rank Fusion (RRF) to merge dense semantic and sparse lexical search rankings.',
      'Pass top-25 merged results through a Cross-Encoder reranker to extract top-4 high-relevance chunks.',
      'Prompt an LLM with strict grounding constraints and run automated Ragas evaluation benchmarks.',
    ],
    challenge: 'Add self-reflective query expansion and HyDE (Hypothetical Document Embeddings) to handle ambiguous user queries.',
  },
  {
    title: 'Multimodal zero-shot image & text retrieval with CLIP',
    level: 'HARD',
    goal: 'Implement a contrastive visual-semantic shared embedding space to perform cross-modal search (text-to-image and image-to-image) with FAISS vector indexing.',
    dataset: 'MS-COCO / Flickr30k (Creative Commons)',
    metrics: ['Recall@1', 'Recall@5', 'MRR (Mean Reciprocal Rank)'],
    tags: ['Multimodal AI', 'CLIP', 'Contrastive Learning', 'FAISS', 'Embeddings'],
    steps: [
      'Construct a paired image-text data loader with batch-wise contrastive negative sampling.',
      'Compute normalized image embeddings from a Vision Transformer (ViT) and text embeddings from a Transformer.',
      'Calculate the symmetric cosine similarity matrix and apply temperature-scaled cross-entropy loss.',
      'Index 50,000 image vectors into an HNSW (Hierarchical Navigable Small World) FAISS graph.',
      'Implement natural language text search querying the image index in sub-10ms latency.',
      'Evaluate Zero-Shot classification accuracy across unseen image categories without fine-tuning.',
    ],
    challenge: 'Implement image + text query arithmetic (e.g., Image of a dog + "sunglasses" = retrieved image of dog wearing sunglasses).',
  },
  {
    title: 'Deep Q-learning for autonomous dynamic grid navigation',
    level: 'HARD',
    goal: 'Train an autonomous reinforcement learning agent to navigate stochastic environments with dynamic obstacles using Double DQN and Prioritized Experience Replay.',
    dataset: 'Gymnasium MiniGrid / Highway-env Environment',
    metrics: ['Average Cumulative Reward', 'Success Rate', 'Sample Efficiency'],
    tags: ['Reinforcement Learning', 'Deep Q-Networks', 'Gymnasium', 'PyTorch'],
    steps: [
      'Define Markov Decision Process (MDP): state space observations, discrete actions, and sparse reward signals.',
      'Construct a Q-Network with convolutional or MLP layers to approximate action-value function Q(s, a).',
      'Implement a Prioritized Experience Replay (PER) buffer using a SumTree data structure.',
      'Decouple action selection from action evaluation using a separate Target Network with Polyak soft updates (Double DQN).',
      'Implement an epsilon-greedy exploration schedule with exponential decay over training episodes.',
      'Record reward trajectories, evaluate against a random agent baseline, and visualize agent policy paths.',
    ],
    challenge: 'Upgrade architecture to Dueling DQN with separate Value V(s) and Advantage A(s, a) streams to accelerate policy convergence.',
  },
]

export function ProjectsPage() {
  const [levelFilter, setLevelFilter] = useState<'ALL' | ProjectLevel>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProjects = projects.filter((project) => {
    const matchesLevel = levelFilter === 'ALL' || project.level === levelFilter
    const matchesSearch =
      !searchQuery.trim() ||
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesLevel && matchesSearch
  })

  const counts = {
    ALL: projects.length,
    BEGINNER: projects.filter((p) => p.level === 'BEGINNER').length,
    INTERMEDIATE: projects.filter((p) => p.level === 'INTERMEDIATE').length,
    HARD: projects.filter((p) => p.level === 'HARD').length,
  }

  return (
    <div className="page-content projects-page">
      <PageIntro
        eyebrow="PORTFOLIO LABS"
        title="Real-world engineering projects."
        description="From foundational linear models to fine-tuning modern LLMs, multimodal retrieval, and deep reinforcement learning. Complete with architecture roadmaps, metrics, and stretch challenges."
        action={<span className="content-counter">{projects.length} GUIDED BRIEFS</span>}
      />

      <div className="collection-callout">
        <FlaskConical size={18} />
        <p>
          Each project brief includes target evaluation metrics, datasets with open licenses, execution roadmaps, and an advanced engineering challenge. Pick a brief and build it locally in Python, PyTorch, or Jupyter.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="project-controls-bar">
        <div className="segmented-control" role="group" aria-label="Filter projects by difficulty">
          {(['ALL', 'BEGINNER', 'INTERMEDIATE', 'HARD'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={levelFilter === lvl ? 'segment-active' : ''}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl === 'ALL' ? 'All levels' : lvl.charAt(0) + lvl.slice(1).toLowerCase()} ({counts[lvl]})
            </button>
          ))}
        </div>

        <div className="project-search-box">
          <input
            type="text"
            placeholder="Search by topic, model, or tag (e.g. LLM, Vision, XGBoost)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="project-grid">
        {filteredProjects.map((project, index) => (
          <article className="project-card" key={project.title}>
            <div className="project-index">
              <span>0{index + 1}</span>
              <span className={`project-level-pill level-${project.level.toLowerCase()}`}>
                {project.level}
              </span>
            </div>

            <h2>{project.title}</h2>
            <p className="project-goal">{project.goal}</p>

            <div className="project-meta-box">
              <div>
                <strong>Dataset:</strong> {project.dataset}
              </div>
              <div>
                <strong>Key Metrics:</strong> {project.metrics.join(' · ')}
              </div>
            </div>

            <div className="project-tags">
              {project.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <details>
              <summary>
                <span>View execution roadmap & steps</span>
                <ChevronDown size={14} />
              </summary>
              <div className="project-details-body">
                <ol className="project-steps-list">
                  {project.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>

                <div className="project-challenge-box">
                  <b>⚡ EXPERT STRETCH GOAL:</b>
                  <p>{project.challenge}</p>
                </div>
              </div>
            </details>
          </article>
        ))}

        {filteredProjects.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <span><Search size={22} /></span>
            <h2>No projects match your filter.</h2>
            <p>Try clearing your search query or selecting "All levels" to see all 12 projects.</p>
            <button
              className="button button-dark"
              onClick={() => { setLevelFilter('ALL'); setSearchQuery('') }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const questions = [
  { title: 'Why split data into train, validation, and test sets?', group: 'FOUNDATIONS', answer: 'Training data fits parameters. Validation data compares hyperparameters and model variants. The test set gives a final, untouched estimate of performance. Repeatedly checking the test set turns it into part of the tuning process and makes the estimate optimistic.' },
  { title: 'What does gradient descent actually do?', group: 'OPTIMIZATION', answer: 'It evaluates how loss changes with each parameter, then steps opposite the gradient. The learning rate controls step size. It can converge slowly, overshoot, or settle in a local region depending on the problem and setup.' },
  { title: 'Why can accuracy be misleading?', group: 'EVALUATION', answer: 'For imbalanced classes, predicting only the majority class may give high accuracy while missing most minority cases. Inspect the confusion matrix and costs of false positives and false negatives; precision and recall show different parts of the picture.' },
  { title: 'How do you explain overfitting?', group: 'GENERALIZATION', answer: 'Overfitting occurs when a model fits accidental details of training examples rather than stable structure. A common warning is much lower training error than validation error. Simpler models, regularization, representative data, and sound validation can help.' },
]

export function InterviewPage() {
  const [filter, setFilter] = useState('ALL')
  const groups = ['ALL', ...new Set(questions.map((question) => question.group))]
  return <div className="page-content"><PageIntro eyebrow="THINK OUT LOUD" title="Practice the why, not just the what." description="A useful interview answer explains the idea, the trade-off, and when you’d reach for it." action={<span className="content-counter">{questions.length} PRACTICE QUESTIONS</span>} /><div className="interview-filters" role="group" aria-label="Filter interview questions by topic">{groups.map((group) => <button type="button" aria-pressed={filter === group} className={filter === group ? 'filter-active' : ''} onClick={() => setFilter(group)} key={group}>{group === 'ALL' ? 'All' : group.toLowerCase()}</button>)}</div><div className="interview-list" aria-live="polite">{questions.filter((question) => filter === 'ALL' || question.group === filter).map((question, index) => <details className="interview-question" key={question.title}><summary><span>{String(index + 1).padStart(2, '0')}</span><span><small>{question.group}</small><b>{question.title}</b></span><ChevronDown size={16} /></summary><div className="interview-answer"><small>THE SHORT ANSWER</small><p>{question.answer}</p><div>Follow-up to consider: <b>What assumption would you check before applying this idea?</b></div></div></details>)}</div><div className="interview-note"><GraduationCap size={17} /><p>These are practice prompts, not a promise about any interview. Use them to rehearse clear, honest reasoning.</p></div></div>
}

export function RevisionPage() {
  const { state } = useLearning()
  const cards = lessons.filter((lesson) => state.bookmarks.includes(lesson.slug) || state.completed.includes(lesson.slug))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const card = cards[index]
  if (!card) return <div className="page-content"><PageIntro eyebrow="RETRIEVAL PRACTICE" title="Bring an idea back to mind." description="Reviewing from memory helps you find what you really understand." /><div className="empty-state"><span><Sparkles size={20} /></span><h2>Your deck is ready when you are.</h2><p>Complete or bookmark a lesson to add its key ideas here.</p><Link to="/curriculum" className="text-link">Choose a lesson <ArrowRight size={14} /></Link></div></div>
  return <div className="page-content revision-page"><PageIntro eyebrow="RETRIEVAL PRACTICE" title="Bring an idea back to mind." description={`Card ${index + 1} of ${cards.length}. Say what you remember before revealing the key points.`} /><div className="flashcard"><span>LESSON {card.number} · {card.module.toUpperCase()}</span><h2>{card.title}</h2><p>{revealed ? card.takeaways[0] : card.interview.question}</p>{revealed && <ul>{card.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>}<button className="button button-dark" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide answer' : 'Reveal key idea'} <ArrowRight size={15} /></button></div><div className="flashcard-controls"><button onClick={() => { setIndex((index + cards.length - 1) % cards.length); setRevealed(false) }}><ChevronLeft size={16} /> Previous</button><div>{cards.map((_, item) => <i className={index === item ? 'flashcard-current' : ''} key={item} />)}</div><button onClick={() => { setIndex((index + 1) % cards.length); setRevealed(false) }}>Next <ChevronRight size={16} /></button></div></div>
}
