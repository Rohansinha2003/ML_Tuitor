import { useId, useState, type ReactNode } from 'react'
import { FlaskConical, Lightbulb, RotateCcw } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageIntro } from './pages'

const regressionPoints = [
  { x: 0.5, y: 1.7 }, { x: 1.2, y: 2.2 }, { x: 1.9, y: 2.9 },
  { x: 2.7, y: 3.1 }, { x: 3.3, y: 4.1 }, { x: 4.1, y: 4.5 },
  { x: 4.8, y: 5.7 }, { x: 5.6, y: 5.6 }, { x: 6.3, y: 6.9 }, { x: 7.2, y: 7.2 },
]

const labTabs = [
  { id: 'regression', label: 'Linear regression' },
  { id: 'descent', label: 'Gradient descent' },
  { id: 'overfit', label: 'Overfit vs. underfit' },
  { id: 'boundary', label: 'Decision boundaries' },
  { id: 'kmeans', label: 'K-means' },
] as const

type LabMode = typeof labTabs[number]['id']
type XY = { x: number; y: number }
type LabeledPoint = XY & { label: number }

export function PlaygroundLab() {
  const [mode, setMode] = useState<LabMode>('regression')
  const selectedIndex = labTabs.findIndex((tab) => tab.id === mode)
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (selectedIndex + direction + labTabs.length) % labTabs.length
    setMode(labTabs[nextIndex].id)
    document.getElementById(`lab-tab-${labTabs[nextIndex].id}`)?.focus()
  }
  return <div className="page-content playground-page">
    <PageIntro eyebrow="THE VISUAL LAB" title="Learn by turning the knobs." description="Change one choice at a time. Watch the model, its mistakes, and its limits move with it." />
    <div className="playground-tabs" role="tablist" aria-label="Choose an interactive machine learning demonstration" onKeyDown={onTabKeyDown}>
      {labTabs.map((tab) => <button key={tab.id} id={`lab-tab-${tab.id}`} role="tab" aria-selected={mode === tab.id} aria-controls="lab-panel" tabIndex={mode === tab.id ? 0 : -1} className={mode === tab.id ? 'tab-active' : ''} onClick={() => setMode(tab.id)}>{tab.label}</button>)}
    </div>
    <div id="lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${mode}`}>
      {mode === 'regression' && <RegressionLab />}
      {mode === 'descent' && <GradientDescentLab />}
      {mode === 'overfit' && <OverfitLab />}
      {mode === 'boundary' && <DecisionBoundaryLab />}
      {mode === 'kmeans' && <KMeansLab />}
    </div>
  </div>
}

function LabFrame({
  kicker, title, chart, controls, explanation,
}: { kicker: string; title: string; chart: ReactNode; controls: ReactNode; explanation: string }) {
  return <>
    <div className="playground-workspace">
      <section className="playground-chart" aria-label={title}>
        <div className="playground-chart-head"><div><small>{kicker}</small><h2>{title}</h2></div><span className="chart-live"><i /> LIVE</span></div>
        {chart}
      </section>
      <aside className="playground-controls">
        <div className="control-heading"><span><FlaskConical size={17} /></span><div><b>Model controls</b><small>Every adjustment updates the result.</small></div></div>
        {controls}
      </aside>
    </div>
    <div className="playground-explainer"><Lightbulb size={16} /><div><b>What to notice</b><p>{explanation}</p></div></div>
  </>
}

function LabSlider({
  label, value, min, max, step, onChange, description, format,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; description: string; format?: (value: number) => string }) {
  const id = useId()
  return <div className="slider-control">
    <label htmlFor={id}><span><b>{label}</b><output htmlFor={id} aria-live="polite">{format ? format(value) : value}</output></span></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-describedby={`${id}-help`} />
    <small id={`${id}-help`}>{description}</small>
  </div>
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return <button className="reset-controls" type="button" onClick={onClick}><RotateCcw size={13} /> Reset demo</button>
}

function ChartLegend({ items }: { items: { label: string; className: string }[] }) {
  return <div className="chart-legend">{items.map((item) => <span key={item.label}><i className={item.className} />{item.label}</span>)}</div>
}

function RegressionLab() {
  const [slope, setSlope] = useState(1.15)
  const [intercept, setIntercept] = useState(0.4)
  const fitted = Array.from({ length: 33 }, (_, index) => ({ x: index / 4, y: slope * index / 4 + intercept }))
  const mse = meanSquaredError(regressionPoints, (point) => slope * point.x + intercept)
  return <LabFrame kicker="FIT A LINE" title="What does a good fit look like?" chart={<>
    <ChartLegend items={[{ label: 'Observed examples', className: 'legend-dot-observed' }, { label: 'Your model', className: 'legend-line-model' }]} />
    <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} /><XAxis type="number" dataKey="x" name="Hours practiced" domain={[0, 8]} tickLine={false} axisLine={false} /><YAxis type="number" dataKey="y" name="Skills learned" domain={[0, 10]} tickLine={false} axisLine={false} /><Tooltip /><Scatter name="Observed examples" data={regressionPoints} fill="var(--chart-point)" /><Line name="Your model" data={fitted} dataKey="y" type="linear" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} /></ScatterChart></ResponsiveContainer></div>
    <div className="chart-axis-labels"><span>HOURS OF PRACTICE →</span><span>MEAN SQUARED ERROR <b>{mse.toFixed(2)}</b></span></div>
  </>} controls={<>
    <LabSlider label="Slope · w" value={slope} min={-1} max={2} step={0.05} onChange={setSlope} format={(value) => value.toFixed(2)} description="How much the prediction rises for one more hour." />
    <LabSlider label="Intercept · b" value={intercept} min={-2} max={3} step={0.05} onChange={setIntercept} format={(value) => value.toFixed(2)} description="The predicted skill score at zero practice hours." />
    <div className="live-equation">ŷ = <b>{slope.toFixed(2)}</b>x + <b>{intercept.toFixed(2)}</b></div>
    <p className="control-note">MSE squares each prediction miss, then averages them. Lower is better for this dataset.</p>
    <ResetButton onClick={() => { setSlope(1.15); setIntercept(0.4) }} />
  </>} explanation="The dots are observed examples; the line is your model. Moving slope and intercept changes every prediction. The MSE updates immediately, so you can see why a line through the middle usually beats one that misses all the points." />
}

function GradientDescentLab() {
  const [learningRate, setLearningRate] = useState(0.015)
  const [steps, setSteps] = useState(50)
  const lossHistory = runGradientDescent(regressionPoints, learningRate, steps)
  const final = lossHistory[lossHistory.length - 1]
  return <LabFrame kicker="WATCH IT LEARN" title="How does a model find a better line?" chart={<>
    <ChartLegend items={[{ label: 'Mean squared error during training', className: 'legend-line-model' }]} />
    <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={lossHistory} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} /><XAxis dataKey="step" name="Update step" tickLine={false} axisLine={false} /><YAxis dataKey="loss" name="MSE" domain={['auto', 'auto']} tickLine={false} axisLine={false} /><Tooltip /><ReferenceLine y={0} stroke="var(--chart-muted)" strokeDasharray="4 4" /><Line dataKey="loss" type="monotone" stroke="var(--chart-line)" strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
    <div className="chart-axis-labels"><span>PARAMETER UPDATES →</span><span>FINAL MSE <b>{final.loss.toFixed(3)}</b></span></div>
  </>} controls={<>
    <LabSlider label="Learning rate · α" value={learningRate} min={0.001} max={0.04} step={0.001} onChange={setLearningRate} format={(value) => value.toFixed(3)} description="Step size. Too small learns slowly; too large can jump past a good fit." />
    <LabSlider label="Number of updates" value={steps} min={5} max={120} step={5} onChange={setSteps} description="More updates give the optimizer more chances to reduce training error." />
    <div className="live-equation">w = <b>{final.slope.toFixed(2)}</b> <span>·</span> b = <b>{final.intercept.toFixed(2)}</b></div>
    <p className="control-note">This demo really computes the gradients of MSE for slope and intercept on the plotted examples.</p>
    <ResetButton onClick={() => { setLearningRate(0.015); setSteps(50) }} />
  </>} explanation="Each update moves slope and intercept opposite the loss gradient. A steady downward curve means these steps are reducing the measured training error. If you raise the learning rate too far, the curve can rise or wobble instead of settling." />
}

function runGradientDescent(points: XY[], learningRate: number, steps: number) {
  let slope = 0
  let intercept = 0
  const history = [{ step: 0, loss: meanSquaredError(points, (point) => slope * point.x + intercept), slope, intercept }]
  for (let step = 1; step <= steps; step += 1) {
    const count = points.length
    const slopeGradient = points.reduce((sum, point) => sum + 2 * point.x * (slope * point.x + intercept - point.y), 0) / count
    const interceptGradient = points.reduce((sum, point) => sum + 2 * (slope * point.x + intercept - point.y), 0) / count
    slope -= learningRate * slopeGradient
    intercept -= learningRate * interceptGradient
    history.push({ step, loss: meanSquaredError(points, (point) => slope * point.x + intercept), slope, intercept })
  }
  return history
}

function OverfitLab() {
  const [degree, setDegree] = useState(1)
  const [noise, setNoise] = useState(0.55)
  const points = createCurveData(noise)
  const training = points.filter((_, index) => index % 4 !== 0)
  const validation = points.filter((_, index) => index % 4 === 0)
  const coefficients = fitPolynomial(training, degree)
  const predict = (x: number) => evaluatePolynomial(coefficients, 2 * x - 1)
  const curve = Array.from({ length: 61 }, (_, index) => { const x = index / 60; return { x, y: predict(x) } })
  const trainMse = meanSquaredError(training, (point) => predict(point.x))
  const validationMse = meanSquaredError(validation, (point) => predict(point.x))
  return <LabFrame kicker="MODEL COMPLEXITY" title="When does a model learn noise?" chart={<>
    <ChartLegend items={[{ label: 'Training examples', className: 'legend-dot-observed' }, { label: 'Held-out examples', className: 'legend-dot-validation' }, { label: `Polynomial · degree ${degree}`, className: 'legend-line-model' }]} />
    <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} /><XAxis type="number" dataKey="x" name="Input x" domain={[0, 1]} tickLine={false} axisLine={false} /><YAxis type="number" dataKey="y" name="Target y" domain={['auto', 'auto']} tickLine={false} axisLine={false} /><Tooltip /><Scatter name="Training" data={training} fill="var(--chart-point)" /><Scatter name="Held out" data={validation} fill="var(--chart-validation)" /><Line name="Fitted model" data={curve} dataKey="y" type="monotone" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} /></ScatterChart></ResponsiveContainer></div>
    <div className="metric-pair"><span>TRAINING MSE <b>{trainMse.toFixed(3)}</b></span><span>HELD-OUT MSE <b>{validationMse.toFixed(3)}</b></span></div>
  </>} controls={<>
    <LabSlider label="Polynomial degree" value={degree} min={1} max={9} step={1} onChange={setDegree} description="Higher degree bends more. Too much flexibility can chase noise." />
    <LabSlider label="Data noise" value={noise} min={0} max={1.5} step={0.05} onChange={setNoise} format={(value) => value.toFixed(2)} description="Adds repeatable scatter around the underlying smooth pattern." />
    <div className="live-equation">degree <b>{degree}</b> <span>·</span> gap <b>{Math.abs(validationMse - trainMse).toFixed(3)}</b></div>
    <p className="control-note">A large training/held-out gap can be a warning sign. Compare both errors, not just the training fit.</p>
    <ResetButton onClick={() => { setDegree(1); setNoise(0.55) }} />
  </>} explanation="Degree 1 is a straight line and may miss a curved pattern (underfitting). A very high degree can weave through training noise and predict held-out points poorly (overfitting). The split and both error values update with the controls." />
}

function createCurveData(noise: number): XY[] {
  return Array.from({ length: 28 }, (_, index) => {
    const x = index / 27
    const centered = 2 * x - 1
    const signal = 1.8 + 1.4 * centered - 0.9 * centered ** 2 + 0.35 * Math.sin(centered * 3.3)
    const randomLikeValue = Math.sin(index * 127.1 + 311.7) * 43758.5453
    const repeatableNoise = (2 * (randomLikeValue - Math.floor(randomLikeValue)) - 1) * noise
    return { x, y: signal + repeatableNoise }
  })
}

function fitPolynomial(points: XY[], degree: number): number[] {
  const size = degree + 1
  const matrix = Array.from({ length: size }, (_, row) => [
    ...Array.from({ length: size }, (_, column) => points.reduce((sum, point) => sum + (2 * point.x - 1) ** (row + column), 0) + (row === column && row > 0 ? 1e-7 : 0)),
    points.reduce((sum, point) => sum + point.y * (2 * point.x - 1) ** row, 0),
  ])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row
    }
    ;[matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]]
    const divisor = matrix[column][column]
    if (Math.abs(divisor) < 1e-12) return Array(size).fill(0)
    for (let entry = column; entry <= size; entry += 1) matrix[column][entry] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = matrix[row][column]
      for (let entry = column; entry <= size; entry += 1) matrix[row][entry] -= factor * matrix[column][entry]
    }
  }
  return matrix.map((row) => row[size])
}

function evaluatePolynomial(coefficients: number[], x: number) {
  return coefficients.reduceRight((value, coefficient) => value * x + coefficient, 0)
}

function DecisionBoundaryLab() {
  const [neighborCount, setNeighborCount] = useState(3)
  const [points, setPoints] = useState<LabeledPoint[]>(createBoundaryData)
  const [newX, setNewX] = useState(5)
  const [newY, setNewY] = useState(5)
  const [newClass, setNewClass] = useState(0)
  const gridColumns = 25
  const gridRows = 18
  const cells = Array.from({ length: gridColumns * gridRows }, (_, index) => {
    const column = index % gridColumns
    const row = Math.floor(index / gridColumns)
    const x = (column + 0.5) * 10 / gridColumns
    const y = 10 - (row + 0.5) * 10 / gridRows
    return { column, row, label: classifyKnn({ x, y }, points, neighborCount) }
  })
  const reset = () => { setNeighborCount(3); setPoints(createBoundaryData()); setNewX(5); setNewY(5); setNewClass(0) }
  const addExample = () => setPoints((current) => [...current, { x: newX, y: newY, label: newClass }])
  return <LabFrame kicker="CLASSIFICATION" title="How does a decision boundary move?" chart={<>
    <ChartLegend items={[{ label: 'Class A', className: 'legend-class-a' }, { label: 'Class B', className: 'legend-class-b' }, { label: 'Predicted region', className: 'legend-region' }]} />
    <div className="svg-chart-wrap"><svg viewBox="0 0 400 300" role="img" aria-label={`K-nearest-neighbors decision regions with ${neighborCount} neighbors. The background shows predicted classes and circles show labeled examples.`}>
      <rect width="400" height="300" fill="var(--surface)" />
      {cells.map((cell) => <rect key={`${cell.column}-${cell.row}`} x={cell.column * 400 / gridColumns} y={cell.row * 300 / gridRows} width={400 / gridColumns + 0.5} height={300 / gridRows + 0.5} fill={cell.label === 0 ? 'var(--boundary-a)' : 'var(--boundary-b)'} />)}
      {points.map((point, index) => <circle key={index} cx={point.x * 40} cy={300 - point.y * 30} r="6" fill={point.label === 0 ? 'var(--point-a)' : 'var(--point-b)'} stroke="var(--surface)" strokeWidth="2"><title>{`Class ${point.label === 0 ? 'A' : 'B'} example at x=${point.x.toFixed(1)}, y=${point.y.toFixed(1)}`}</title></circle>)}
      <path d="M0 300H400M0 0V300" stroke="var(--line-strong)" strokeWidth="1" fill="none" />
    </svg></div>
    <div className="chart-axis-labels"><span>FEATURE 1 →</span><span>{points.length} LABELED EXAMPLES</span></div>
  </>} controls={<>
    <LabSlider label="Neighbors · k" value={neighborCount} min={1} max={15} step={2} onChange={setNeighborCount} description="How many nearby examples vote. Small k makes jagged regions; larger k smooths them." />
    <div className="add-point-controls"><span className="control-caption">ADD A LABELED EXAMPLE</span><div className="class-switch" role="group" aria-label="Choose the new example class"><button type="button" aria-pressed={newClass === 0} className={newClass === 0 ? 'class-selected class-a' : ''} onClick={() => setNewClass(0)}>Class A</button><button type="button" aria-pressed={newClass === 1} className={newClass === 1 ? 'class-selected class-b' : ''} onClick={() => setNewClass(1)}>Class B</button></div>
      <LabSlider label="Feature 1" value={newX} min={0} max={10} step={0.5} onChange={setNewX} description="Horizontal position of the example." />
      <LabSlider label="Feature 2" value={newY} min={0} max={10} step={0.5} onChange={setNewY} description="Vertical position of the example." />
      <button className="add-example-button" type="button" onClick={addExample}>Add example to chart</button>
    </div>
    <p className="control-note">The new point becomes part of the labeled training set and changes nearby predictions.</p>
    <ResetButton onClick={reset} />
  </>} explanation="The background color is the class predicted at that location. KNN asks the nearest k labeled examples to vote. Add a point near the border or change k to see how local evidence reshapes the regions." />
}

function createBoundaryData(): LabeledPoint[] {
  return [
    { x: 1.4, y: 1.8, label: 0 }, { x: 2.1, y: 2.7, label: 0 }, { x: 3.2, y: 1.4, label: 0 },
    { x: 2.8, y: 4.1, label: 0 }, { x: 1.2, y: 5.7, label: 0 }, { x: 3.4, y: 6.8, label: 0 },
    { x: 4.0, y: 3.0, label: 0 }, { x: 4.2, y: 7.7, label: 0 }, { x: 6.2, y: 2.2, label: 1 },
    { x: 7.8, y: 1.4, label: 1 }, { x: 8.7, y: 3.1, label: 1 }, { x: 6.5, y: 4.0, label: 1 },
    { x: 8.2, y: 5.5, label: 1 }, { x: 6.7, y: 7.0, label: 1 }, { x: 9.0, y: 8.2, label: 1 },
    { x: 5.2, y: 8.1, label: 1 },
  ]
}

function classifyKnn(query: XY, points: LabeledPoint[], k: number) {
  const nearest = points.map((point) => ({
    label: point.label,
    distance: (point.x - query.x) ** 2 + (point.y - query.y) ** 2,
  })).sort((first, second) => first.distance - second.distance).slice(0, k)
  const classOneVotes = nearest.filter((point) => point.label === 1).length
  return classOneVotes > nearest.length / 2 ? 1 : 0
}

const clusterColors = ['var(--chart-point)', 'var(--chart-line)', 'var(--chart-validation)', 'var(--cluster-four)', 'var(--cluster-five)']
const initialClusterPoints: XY[] = [
  { x: 1.1, y: 1.8 }, { x: 1.8, y: 2.5 }, { x: 2.7, y: 1.3 }, { x: 3.2, y: 2.8 },
  { x: 6.5, y: 1.4 }, { x: 7.4, y: 2.4 }, { x: 8.4, y: 1.5 }, { x: 7.6, y: 3.3 },
  { x: 3.5, y: 6.6 }, { x: 4.3, y: 7.5 }, { x: 5.2, y: 6.4 }, { x: 4.1, y: 8.4 },
  { x: 8.2, y: 7.1 }, { x: 8.8, y: 8.2 }, { x: 9.2, y: 6.6 }, { x: 7.5, y: 8.7 },
]

function KMeansLab() {
  const [clusterCount, setClusterCount] = useState(3)
  const [iterations, setIterations] = useState(4)
  const result = runKMeans(initialClusterPoints, clusterCount, iterations)
  const reset = () => { setClusterCount(3); setIterations(4) }
  return <LabFrame kicker="UNSUPERVISED LEARNING" title="How does K-means form groups?" chart={<>
    <ChartLegend items={clusterColors.slice(0, clusterCount).map((_, index) => ({ label: `Cluster ${index + 1}`, className: `legend-cluster-${index + 1}` }))} />
    <div className="svg-chart-wrap"><svg viewBox="0 0 400 300" role="img" aria-label={`K-means result with ${clusterCount} groups after ${result.iterations} iterations. Colored circles are assigned points and stars are cluster centers.`}>
      <rect width="400" height="300" fill="var(--surface)" />
      <path d="M0 300H400M0 0V300" stroke="var(--line-strong)" strokeWidth="1" fill="none" />
      {result.points.map((point, index) => <circle key={index} cx={point.x * 40} cy={300 - point.y * 30} r="6" fill={clusterColors[point.cluster]} stroke="var(--surface)" strokeWidth="2"><title>{`Example assigned to cluster ${point.cluster + 1}`}</title></circle>)}
      {result.centers.map((center, index) => <g key={index} transform={`translate(${center.x * 40} ${300 - center.y * 30})`}><path d="M0 -10L2.5 -3L10 -3L4 1.5L6.5 9L0 4.5L-6.5 9L-4 1.5L-10 -3L-2.5 -3Z" fill={clusterColors[index]} stroke="var(--surface)" strokeWidth="1.5"><title>{`Center of cluster ${index + 1}`}</title></path></g>)}
    </svg></div>
    <div className="metric-pair"><span>WITHIN-CLUSTER SQUARED DISTANCE <b>{result.inertia.toFixed(1)}</b></span><span>ITERATIONS RUN <b>{result.iterations}</b></span></div>
  </>} controls={<>
    <LabSlider label="Number of clusters · k" value={clusterCount} min={2} max={5} step={1} onChange={setClusterCount} description="How many centers K-means tries to place. Choose this before fitting." />
    <LabSlider label="Update steps" value={iterations} min={1} max={12} step={1} onChange={setIterations} description="Each step assigns points, then moves each center to its group average." />
    <div className="live-equation">k = <b>{clusterCount}</b> <span>·</span> steps = <b>{result.iterations}</b></div>
    <p className="control-note">Cluster numbers are names, not rankings. K-means uses distance, so feature scales matter.</p>
    <ResetButton onClick={reset} />
  </>} explanation="Each point joins its nearest center; each center moves to the average position of its assigned points. Changing k changes the number of groups. More update steps let assignments and centers settle, though the result can depend on initialization." />
}

function runKMeans(points: XY[], clusterCount: number, maxIterations: number) {
  const centers: XY[] = [points[0]]
  while (centers.length < clusterCount) {
    const farthest = points.reduce((best, point) => {
      const distance = Math.min(...centers.map((center) => squaredDistance(point, center)))
      return distance > best.distance ? { point, distance } : best
    }, { point: points[0], distance: -1 }).point
    centers.push(farthest)
  }
  let completedIterations = 0
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const assignments = points.map((point) => nearestCenter(point, centers))
    const nextCenters = centers.map((center, cluster) => {
      const members = points.filter((_, index) => assignments[index] === cluster)
      if (!members.length) return center
      return { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length }
    })
    const movement = centers.reduce((sum, center, index) => sum + squaredDistance(center, nextCenters[index]), 0)
    centers.splice(0, centers.length, ...nextCenters)
    completedIterations = iteration + 1
    if (movement < 1e-8) break
  }
  const assignedPoints = points.map((point) => ({ ...point, cluster: nearestCenter(point, centers) }))
  const inertia = assignedPoints.reduce((sum, point) => sum + squaredDistance(point, centers[point.cluster]), 0)
  return { points: assignedPoints, centers: [...centers], inertia, iterations: completedIterations }
}

function nearestCenter(point: XY, centers: XY[]) {
  return centers.reduce((bestIndex, center, index) => squaredDistance(point, center) < squaredDistance(point, centers[bestIndex]) ? index : bestIndex, 0)
}

function squaredDistance(first: XY, second: XY) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2
}

function meanSquaredError(points: XY[], predict: (point: XY) => number) {
  return points.reduce((sum, point) => sum + (point.y - predict(point)) ** 2, 0) / points.length
}
