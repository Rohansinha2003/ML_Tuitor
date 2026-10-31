import { useId, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  Code2,
  Copy,
  FlaskConical,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  { id: 'boundary', label: 'Decision boundaries (KNN)' },
  { id: 'kmeans', label: 'K-means clustering' },
  { id: 'activations', label: 'Neural activations & gradients' },
  { id: 'attention', label: 'Transformer self-attention' },
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

  return (
    <div className="page-content playground-page">
      <PageIntro
        eyebrow="THE INTERACTIVE VISUAL LAB"
        title="Learn by turning the knobs."
        description="Change parameters in real-time. Watch the decision boundaries, loss landscapes, gradients, and attention distributions respond immediately."
      />

      <div
        className="playground-tabs"
        role="tablist"
        aria-label="Choose an interactive machine learning demonstration"
        onKeyDown={onTabKeyDown}
      >
        {labTabs.map((tab) => (
          <button
            key={tab.id}
            id={`lab-tab-${tab.id}`}
            role="tab"
            aria-selected={mode === tab.id}
            aria-controls="lab-panel"
            tabIndex={mode === tab.id ? 0 : -1}
            className={mode === tab.id ? 'tab-active' : ''}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${mode}`}>
        {mode === 'regression' && <RegressionLab />}
        {mode === 'descent' && <GradientDescentLab />}
        {mode === 'overfit' && <OverfitLab />}
        {mode === 'boundary' && <DecisionBoundaryLab />}
        {mode === 'kmeans' && <KMeansLab />}
        {mode === 'activations' && <ActivationLab />}
        {mode === 'attention' && <AttentionLab />}
      </div>
    </div>
  )
}

function LabFrame({
  kicker,
  title,
  chart,
  controls,
  explanation,
  learningMaterial,
}: {
  kicker: string
  title: string
  chart: ReactNode
  controls: ReactNode
  explanation: string
  learningMaterial?: {
    formula: string
    concept: string
    experiments: string[]
    code: string
    pitfalls: string
  }
}) {
  return (
    <>
      <div className="playground-workspace">
        <section className="playground-chart" aria-label={title}>
          <div className="playground-chart-head">
            <div>
              <small>{kicker}</small>
              <h2>{title}</h2>
            </div>
            <span className="chart-live">
              <i /> LIVE
            </span>
          </div>
          {chart}
        </section>
        <aside className="playground-controls">
          <div className="control-heading">
            <span>
              <FlaskConical size={17} />
            </span>
            <div>
              <b>Model controls</b>
              <small>Every adjustment updates the result.</small>
            </div>
          </div>
          {controls}
        </aside>
      </div>

      <div className="playground-explainer">
        <Lightbulb size={16} />
        <div>
          <b>What to notice</b>
          <p>{explanation}</p>
        </div>
      </div>

      {learningMaterial && <LabDeepDive material={learningMaterial} />}
    </>
  )
}

function LabDeepDive({
  material,
}: {
  material: {
    formula: string
    concept: string
    experiments: string[]
    code: string
    pitfalls: string
  }
}) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    void navigator.clipboard.writeText(material.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="lab-learning-material">
      <div className="learning-header">
        <BookOpen size={17} />
        <h3>Deep Dive: Theory, Code & Experiment Guide</h3>
      </div>

      <div className="learning-grid">
        <div className="learning-card">
          <h4>Mathematical Foundation</h4>
          <div className="math-formula-box">
            <code>{material.formula}</code>
          </div>
          <p>{material.concept}</p>
        </div>

        <div className="learning-card">
          <h4>Interactive Experiments to Try</h4>
          <ul className="learning-experiments-list">
            {material.experiments.map((exp, idx) => (
              <li key={idx}>
                <Sparkles size={13} className="exp-icon" />
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="learning-code-wrapper">
        <div className="learning-code-header">
          <div className="code-lang">
            <Code2 size={15} />
            <span>Python / PyTorch Production Implementation</span>
          </div>
          <button className="copy-code-btn" type="button" onClick={copyCode}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied to clipboard' : 'Copy code'}
          </button>
        </div>
        <pre className="learning-code-pre">
          <code>{material.code}</code>
        </pre>
      </div>

      <div className="learning-pitfall-box">
        <AlertTriangle size={15} />
        <div>
          <b>Industry Pitfall to Watch For:</b>
          <p>{material.pitfalls}</p>
        </div>
      </div>
    </div>
  )
}

function LabSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  description: string
  format?: (value: number) => string
}) {
  const id = useId()
  return (
    <div className="slider-control">
      <label htmlFor={id}>
        <span>
          <b>{label}</b>
          <output htmlFor={id} aria-live="polite">
            {format ? format(value) : value}
          </output>
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={`${id}-help`}
      />
      <small id={`${id}-help`}>{description}</small>
    </div>
  )
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="reset-controls" type="button" onClick={onClick}>
      <RotateCcw size={13} /> Reset demo
    </button>
  )
}

function ChartLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={item.className} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

// -------------------------------------------------------------
// 1. LINEAR REGRESSION LAB
// -------------------------------------------------------------
function RegressionLab() {
  const [slope, setSlope] = useState(1.15)
  const [intercept, setIntercept] = useState(0.4)
  const fitted = Array.from({ length: 33 }, (_, index) => ({
    x: index / 4,
    y: slope * index / 4 + intercept,
  }))
  const mse = meanSquaredError(regressionPoints, (point) => slope * point.x + intercept)

  return (
    <LabFrame
      kicker="FIT A LINE"
      title="What does a good fit look like?"
      chart={
        <>
          <ChartLegend
            items={[
              { label: 'Observed examples', className: 'legend-dot-observed' },
              { label: 'Your model', className: 'legend-line-model' },
            ]}
          />
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis type="number" dataKey="x" name="Hours practiced" domain={[0, 8]} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="y" name="Skills learned" domain={[0, 10]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Scatter name="Observed examples" data={regressionPoints} fill="var(--chart-point)" />
                <Line name="Your model" data={fitted} dataKey="y" type="linear" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-axis-labels">
            <span>HOURS OF PRACTICE →</span>
            <span>MEAN SQUARED ERROR <b>{mse.toFixed(2)}</b></span>
          </div>
        </>
      }
      controls={
        <>
          <LabSlider label="Slope · w" value={slope} min={-1} max={2} step={0.05} onChange={setSlope} format={(value) => value.toFixed(2)} description="How much the prediction rises for one more hour." />
          <LabSlider label="Intercept · b" value={intercept} min={-2} max={3} step={0.05} onChange={setIntercept} format={(value) => value.toFixed(2)} description="The predicted skill score at zero practice hours." />
          <div className="live-equation">
            ŷ = <b>{slope.toFixed(2)}</b>x + <b>{intercept.toFixed(2)}</b>
          </div>
          <p className="control-note">MSE squares each prediction miss, then averages them. Lower is better for this dataset.</p>
          <ResetButton onClick={() => { setSlope(1.15); setIntercept(0.4) }} />
        </>
      }
      explanation="The dots are observed examples; the line is your model. Moving slope and intercept changes every prediction. The MSE updates immediately, so you can see why a line through the middle usually beats one that misses all the points."
      learningMaterial={{
        formula: 'MSE(w, b) = (1/N) * Σ (y_i - (w * x_i + b))²',
        concept:
          'Linear regression assumes that the target is a linear combination of input features plus Gaussian error. The Ordinary Least Squares (OLS) objective minimizes the sum of squared residuals, which directly corresponds to Maximum Likelihood Estimation (MLE) under the assumption of normally distributed noise.',
        experiments: [
          'Set slope to 0.0 and adjust the intercept: notice that the best intercept equals the mean of all y values.',
          'Set slope to 1.15 and intercept to 0.40: notice MSE drops to ~0.15 (the global optimal minimum).',
          'Flip slope to negative (-0.5): observe how MSE explodes quadratic-style as errors compound on both ends.',
        ],
        code: `import numpy as np

def linear_regression_analytical(X, y):
    # Analytical Closed-Form Solution (Normal Equation): w = (X^T X)^(-1) X^T y
    X_b = np.c_[np.ones((len(X), 1)), X]  # add bias column x0 = 1
    w_optimal = np.linalg.inv(X_b.T.dot(X_b)).dot(X_b.T).dot(y)
    intercept, slope = w_optimal[0], w_optimal[1:]
    return slope, intercept

# Example usage:
X = np.array([0.5, 1.2, 1.9, 2.7, 3.3, 4.1, 4.8, 5.6, 6.3, 7.2]).reshape(-1, 1)
y = np.array([1.7, 2.2, 2.9, 3.1, 4.1, 4.5, 5.7, 5.6, 6.9, 7.2])
slope, intercept = linear_regression_analytical(X, y)
print(f"Optimal Line: y = {slope[0]:.2f}x + {intercept:.2f}")`,
        pitfalls:
          'In high dimensions where features exceed samples (p > n) or when features are highly collinear, (X^T X) becomes non-invertible or ill-conditioned. In production, always use Ridge regression (L2 regularization) or Singular Value Decomposition (SVD) rather than direct matrix inversion.',
      }}
    />
  )
}

// -------------------------------------------------------------
// 2. GRADIENT DESCENT LAB
// -------------------------------------------------------------
function GradientDescentLab() {
  const [learningRate, setLearningRate] = useState(0.015)
  const [steps, setSteps] = useState(50)
  const lossHistory = runGradientDescent(regressionPoints, learningRate, steps)
  const final = lossHistory[lossHistory.length - 1]

  return (
    <LabFrame
      kicker="WATCH IT LEARN"
      title="How does a model find a better line?"
      chart={
        <>
          <ChartLegend items={[{ label: 'Mean squared error during training', className: 'legend-line-model' }]} />
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lossHistory} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="step" name="Update step" tickLine={false} axisLine={false} />
                <YAxis dataKey="loss" name="MSE" domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                <Tooltip />
                <ReferenceLine y={0} stroke="var(--chart-muted)" strokeDasharray="4 4" />
                <Line dataKey="loss" type="monotone" stroke="var(--chart-line)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-axis-labels">
            <span>PARAMETER UPDATES →</span>
            <span>FINAL MSE <b>{final.loss.toFixed(3)}</b></span>
          </div>
        </>
      }
      controls={
        <>
          <LabSlider label="Learning rate · α" value={learningRate} min={0.001} max={0.04} step={0.001} onChange={setLearningRate} format={(value) => value.toFixed(3)} description="Step size. Too small learns slowly; too large can jump past a good fit." />
          <LabSlider label="Number of updates" value={steps} min={5} max={120} step={5} onChange={setSteps} description="More updates give the optimizer more chances to reduce training error." />
          <div className="live-equation">
            w = <b>{final.slope.toFixed(2)}</b> <span>·</span> b = <b>{final.intercept.toFixed(2)}</b>
          </div>
          <p className="control-note">This demo really computes the gradients of MSE for slope and intercept on the plotted examples.</p>
          <ResetButton onClick={() => { setLearningRate(0.015); setSteps(50) }} />
        </>
      }
      explanation="Each update moves slope and intercept opposite the loss gradient. A steady downward curve means these steps are reducing the measured training error. If you raise the learning rate too far, the curve can rise or wobble instead of settling."
      learningMaterial={{
        formula: 'w_{t+1} = w_t - α * (∂Loss / ∂w) = w_t - α * (2/N) * Σ x_i(ŷ_i - y_i)',
        concept:
          'Gradient descent is a first-order iterative optimization algorithm. By computing the partial derivatives of the loss function with respect to each model parameter, it moves parameters in the direction of steepest descent (negative gradient). The learning rate α scales the step magnitude.',
        experiments: [
          'Set α to 0.001: observe the loss descends with painful slowness—50 steps is not nearly enough to converge.',
          'Set α to 0.018 and steps to 70: see the smooth, asymptotic exponential decay toward minimum loss.',
          'Push α to 0.038: observe how the loss curve begins oscillating violently as steps overshoot the valley.',
        ],
        code: `import numpy as np

def batch_gradient_descent(X, y, lr=0.015, epochs=100):
    w = 0.0
    b = 0.0
    N = float(len(X))
    loss_history = []
    
    for epoch in range(epochs):
        y_pred = w * X + b
        loss = np.mean((y - y_pred) ** 2)
        loss_history.append(loss)
        
        # Analytical gradients of MSE
        grad_w = (-2 / N) * np.sum(X * (y - y_pred))
        grad_b = (-2 / N) * np.sum(y - y_pred)
        
        # Parameter update
        w -= lr * grad_w
        b -= lr * grad_b
        
    return w, b, loss_history`,
        pitfalls:
          'Feature scale drastically impacts gradient descent convergence. If one feature ranges [0, 1] and another ranges [0, 10000], the loss surface forms an elongated canyon, causing standard SGD to bounce across walls. Always standardize features with zero mean and unit variance before running gradient descent.',
      }}
    />
  )
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

// -------------------------------------------------------------
// 3. OVERFITTING & BIAS-VARIANCE LAB
// -------------------------------------------------------------
function OverfitLab() {
  const [degree, setDegree] = useState(1)
  const [noise, setNoise] = useState(0.55)
  const points = createCurveData(noise)
  const training = points.filter((_, index) => index % 4 !== 0)
  const validation = points.filter((_, index) => index % 4 === 0)
  const coefficients = fitPolynomial(training, degree)
  const predict = (x: number) => evaluatePolynomial(coefficients, 2 * x - 1)
  const curve = Array.from({ length: 61 }, (_, index) => {
    const x = index / 60
    return { x, y: predict(x) }
  })
  const trainMse = meanSquaredError(training, (point) => predict(point.x))
  const validationMse = meanSquaredError(validation, (point) => predict(point.x))

  return (
    <LabFrame
      kicker="MODEL COMPLEXITY"
      title="When does a model learn noise?"
      chart={
        <>
          <ChartLegend
            items={[
              { label: 'Training examples', className: 'legend-dot-observed' },
              { label: 'Held-out examples', className: 'legend-dot-validation' },
              { label: `Polynomial · degree ${degree}`, className: 'legend-line-model' },
            ]}
          />
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis type="number" dataKey="x" name="Input x" domain={[0, 1]} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="y" name="Target y" domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                <Tooltip />
                <Scatter name="Training" data={training} fill="var(--chart-point)" />
                <Scatter name="Held out" data={validation} fill="var(--chart-validation)" />
                <Line name="Fitted model" data={curve} dataKey="y" type="monotone" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="metric-pair">
            <span>TRAINING MSE <b>{trainMse.toFixed(3)}</b></span>
            <span>HELD-OUT MSE <b>{validationMse.toFixed(3)}</b></span>
          </div>
        </>
      }
      controls={
        <>
          <LabSlider label="Polynomial degree" value={degree} min={1} max={9} step={1} onChange={setDegree} description="Higher degree bends more. Too much flexibility can chase noise." />
          <LabSlider label="Data noise" value={noise} min={0} max={1.5} step={0.05} onChange={setNoise} format={(value) => value.toFixed(2)} description="Adds repeatable scatter around the underlying smooth pattern." />
          <div className="live-equation">
            degree <b>{degree}</b> <span>·</span> gap <b>{Math.abs(validationMse - trainMse).toFixed(3)}</b>
          </div>
          <p className="control-note">A large training/held-out gap can be a warning sign. Compare both errors, not just the training fit.</p>
          <ResetButton onClick={() => { setDegree(1); setNoise(0.55) }} />
        </>
      }
      explanation="Degree 1 is a straight line and may miss a curved pattern (underfitting). A very high degree can weave through training noise and predict held-out points poorly (overfitting). The split and both error values update with the controls."
      learningMaterial={{
        formula: 'E_{total} = Bias²(x) + Variance(x) + σ²_{irreducible}',
        concept:
          'The bias-variance tradeoff describes the tension between model simplicity and flexibility. Underfitting occurs when high bias prevents capturing the true data trend. Overfitting occurs when high variance fits idiosyncratic noise in the training sample, yielding poor out-of-sample generalization.',
        experiments: [
          'Set degree = 1: notice training and validation error are both high (~0.60). The model is underfitting.',
          'Set degree = 3: the curve fits the true parabola cleanly, and both training and held-out MSE reach minimums.',
          'Push degree = 8 or 9: training error drops to near-zero, but held-out validation error spikes drastically! This is classic high-variance overfitting.',
        ],
        code: `from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline

def fit_regularized_polynomial(degree, alpha=0.01):
    # Pipeline: Generate polynomial basis terms -> Apply Ridge penalty (L2)
    model = make_pipeline(
        PolynomialFeatures(degree=degree, include_bias=False),
        Ridge(alpha=alpha)  # Controls variance penalty
    )
    return model`,
        pitfalls:
          'Never select hyperparameters based on training error. If you choose the model with the lowest training error, you will almost always choose an overfit model that collapses when deployed to unseen production inputs.',
      }}
    />
  )
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
    ...Array.from({ length: size }, (_, column) =>
      points.reduce((sum, point) => sum + (2 * point.x - 1) ** (row + column), 0) + (row === column && row > 0 ? 1e-7 : 0)
    ),
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

// -------------------------------------------------------------
// 4. DECISION BOUNDARY & KNN LAB
// -------------------------------------------------------------
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
  const reset = () => {
    setNeighborCount(3)
    setPoints(createBoundaryData())
    setNewX(5)
    setNewY(5)
    setNewClass(0)
  }
  const addExample = () => setPoints((current) => [...current, { x: newX, y: newY, label: newClass }])

  return (
    <LabFrame
      kicker="CLASSIFICATION"
      title="How does a decision boundary move?"
      chart={
        <>
          <ChartLegend
            items={[
              { label: 'Class A', className: 'legend-class-a' },
              { label: 'Class B', className: 'legend-class-b' },
              { label: 'Predicted region', className: 'legend-region' },
            ]}
          />
          <div className="svg-chart-wrap">
            <svg viewBox="0 0 400 300" role="img" aria-label={`KNN decision regions with k=${neighborCount}`}>
              <rect width="400" height="300" fill="var(--surface)" />
              {cells.map((cell) => (
                <rect
                  key={`${cell.column}-${cell.row}`}
                  x={(cell.column * 400) / gridColumns}
                  y={(cell.row * 300) / gridRows}
                  width={400 / gridColumns + 0.5}
                  height={300 / gridRows + 0.5}
                  fill={cell.label === 0 ? 'var(--boundary-a)' : 'var(--boundary-b)'}
                />
              ))}
              {points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x * 40}
                  cy={300 - point.y * 30}
                  r="6"
                  fill={point.label === 0 ? 'var(--point-a)' : 'var(--point-b)'}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ))}
              <path d="M0 300H400M0 0V300" stroke="var(--line-strong)" strokeWidth="1" fill="none" />
            </svg>
          </div>
          <div className="chart-axis-labels">
            <span>FEATURE 1 →</span>
            <span>{points.length} LABELED EXAMPLES</span>
          </div>
        </>
      }
      controls={
        <>
          <LabSlider label="Neighbors · k" value={neighborCount} min={1} max={15} step={2} onChange={setNeighborCount} description="How many nearby examples vote. Small k makes jagged regions; larger k smooths them." />
          <div className="add-point-controls">
            <span className="control-caption">ADD A LABELED EXAMPLE</span>
            <div className="class-switch" role="group" aria-label="Choose the new example class">
              <button type="button" aria-pressed={newClass === 0} className={newClass === 0 ? 'class-selected class-a' : ''} onClick={() => setNewClass(0)}>
                Class A
              </button>
              <button type="button" aria-pressed={newClass === 1} className={newClass === 1 ? 'class-selected class-b' : ''} onClick={() => setNewClass(1)}>
                Class B
              </button>
            </div>
            <LabSlider label="Feature 1" value={newX} min={0} max={10} step={0.5} onChange={setNewX} description="Horizontal position of the example." />
            <LabSlider label="Feature 2" value={newY} min={0} max={10} step={0.5} onChange={setNewY} description="Vertical position of the example." />
            <button className="add-example-button" type="button" onClick={addExample}>
              Add example to chart
            </button>
          </div>
          <p className="control-note">The new point becomes part of the labeled training set and changes nearby predictions.</p>
          <ResetButton onClick={reset} />
        </>
      }
      explanation="The background color is the class predicted at that location. KNN asks the nearest k labeled examples to vote. Add a point near the border or change k to see how local evidence reshapes the regions."
      learningMaterial={{
        formula: 'ŷ = argmax_c Σ_{i ∈ N_k(x)} I(y_i = c) where N_k(x) = top-k min ||x - x_i||₂',
        concept:
          'K-Nearest Neighbors is a non-parametric instance-based lazy learner. It stores all training instances and delays computation until query time. Decision boundary complexity is inversely proportional to k: k=1 yields Voronoi tessellation with high variance; large k smooths boundary geometry.',
        experiments: [
          'Set k = 1: observe jagged islands around isolated data points. The model fits individual training points exactly.',
          'Increase k to 11 or 13: the boundary transforms into a smooth, stable separating curve.',
          'Add a Class A outlier deep inside the Class B territory on the right side: notice how small k creates an artificial pocket.',
        ],
        code: `import numpy as np

class KNNClassifier:
    def __init__(self, k=3):
        self.k = k
        
    def fit(self, X, y):
        self.X_train = np.array(X)
        self.y_train = np.array(y)
        
    def predict(self, X_query):
        predictions = []
        for q in X_query:
            # Euclidean distance from query point to all stored points
            distances = np.linalg.norm(self.X_train - q, axis=1)
            # Find indices of k nearest neighbors
            k_indices = np.argsort(distances)[:self.k]
            k_nearest_labels = self.y_train[k_indices]
            # Majority vote
            most_common = np.bincount(k_nearest_labels).argmax()
            predictions.append(most_common)
        return np.array(predictions)`,
        pitfalls:
          'The Curse of Dimensionality: In high dimensions (e.g. d > 50), distance between any two random vectors converges to the same average distance (distance metrics lose discriminative power), causing KNN performance to degrade rapidly unless preceded by PCA or UMAP dimensionality reduction.',
      }}
    />
  )
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
  const nearest = points
    .map((point) => ({
      label: point.label,
      distance: (point.x - query.x) ** 2 + (point.y - query.y) ** 2,
    }))
    .sort((first, second) => first.distance - second.distance)
    .slice(0, k)
  const classOneVotes = nearest.filter((point) => point.label === 1).length
  return classOneVotes > nearest.length / 2 ? 1 : 0
}

// -------------------------------------------------------------
// 5. K-MEANS CLUSTERING LAB
// -------------------------------------------------------------
const clusterColors = [
  'var(--chart-point)',
  'var(--chart-line)',
  'var(--chart-validation)',
  'var(--cluster-four)',
  'var(--cluster-five)',
]
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
  const reset = () => {
    setClusterCount(3)
    setIterations(4)
  }

  return (
    <LabFrame
      kicker="UNSUPERVISED LEARNING"
      title="How does K-means form groups?"
      chart={
        <>
          <ChartLegend
            items={clusterColors.slice(0, clusterCount).map((_, index) => ({
              label: `Cluster ${index + 1}`,
              className: `legend-cluster-${index + 1}`,
            }))}
          />
          <div className="svg-chart-wrap">
            <svg viewBox="0 0 400 300" role="img" aria-label={`K-means result with ${clusterCount} groups`}>
              <rect width="400" height="300" fill="var(--surface)" />
              <path d="M0 300H400M0 0V300" stroke="var(--line-strong)" strokeWidth="1" fill="none" />
              {result.points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x * 40}
                  cy={300 - point.y * 30}
                  r="6"
                  fill={clusterColors[point.cluster]}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ))}
              {result.centers.map((center, index) => (
                <g key={index} transform={`translate(${center.x * 40} ${300 - center.y * 30})`}>
                  <path
                    d="M0 -10L2.5 -3L10 -3L4 1.5L6.5 9L0 4.5L-6.5 9L-4 1.5L-10 -3L-2.5 -3Z"
                    fill={clusterColors[index]}
                    stroke="var(--surface)"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
            </svg>
          </div>
          <div className="metric-pair">
            <span>WITHIN-CLUSTER SQUARED DISTANCE (INERTIA) <b>{result.inertia.toFixed(1)}</b></span>
            <span>ITERATIONS RUN <b>{result.iterations}</b></span>
          </div>
        </>
      }
      controls={
        <>
          <LabSlider label="Number of clusters · k" value={clusterCount} min={2} max={5} step={1} onChange={setClusterCount} description="How many centers K-means tries to place. Choose this before fitting." />
          <LabSlider label="Update steps" value={iterations} min={1} max={12} step={1} onChange={setIterations} description="Each step assigns points, then moves each center to its group average." />
          <div className="live-equation">
            k = <b>{clusterCount}</b> <span>·</span> steps = <b>{result.iterations}</b>
          </div>
          <p className="control-note">Cluster numbers are names, not rankings. K-means uses distance, so feature scales matter.</p>
          <ResetButton onClick={reset} />
        </>
      }
      explanation="Each point joins its nearest center; each center moves to the average position of its assigned points. Changing k changes the number of groups. More update steps let assignments and centers settle, though the result can depend on initialization."
      learningMaterial={{
        formula: 'J = Σ_{j=1}^k Σ_{i ∈ S_j} ||x_i - μ_j||²',
        concept:
          'K-Means partitions n observations into k clusters where each observation belongs to the cluster with the nearest mean (centroid). It uses Lloyd\'s EM-style algorithm: the Assignment Step assigns points to nearest centroids, and the Update Step recalculates centroid coordinates as cluster arithmetic means.',
        experiments: [
          'Set k = 2 and step iterations from 1 to 4: watch the centroids migrate to two big macro-clusters.',
          'Set k = 4 and increase iterations: notice how inertia drops substantially as centroids lock into natural sub-clusters.',
          'Notice that increasing k always monotonically decreases inertia; this is why we use the "Elbow Method" or Silhouette Analysis to choose k.',
        ],
        code: `import numpy as np

def kmeans(X, k=3, max_iters=20):
    # K-Means++ smart initialization
    centroids = [X[np.random.choice(len(X))]]
    for _ in range(1, k):
        dist_sq = np.array([min(np.sum((x - c)**2 for c in centroids)) for x in X])
        probs = dist_sq / dist_sq.sum()
        centroids.append(X[np.random.choice(len(X), p=probs)])
    centroids = np.array(centroids)

    for iteration in range(max_iters):
        # 1. Assignment Step
        distances = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
        cluster_labels = np.argmin(distances, axis=1)
        
        # 2. Update Step
        new_centroids = np.array([X[cluster_labels == i].mean(axis=0) for i in range(k)])
        if np.allclose(centroids, new_centroids):
            break
        centroids = new_centroids
        
    return centroids, cluster_labels`,
        pitfalls:
          'K-Means assumes clusters are spherical, isotropic, and similarly sized. It performs poorly on non-convex shapes (like interlocking crescents) or density-varying clusters. For arbitrary geometries, reach for DBSCAN or Gaussian Mixture Models (GMMs).',
      }}
    />
  )
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
      return {
        x: members.reduce((sum, point) => sum + point.x, 0) / members.length,
        y: members.reduce((sum, point) => sum + point.y, 0) / members.length,
      }
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
  return centers.reduce(
    (bestIndex, center, index) =>
      squaredDistance(point, center) < squaredDistance(point, centers[bestIndex]) ? index : bestIndex,
    0
  )
}

function squaredDistance(first: XY, second: XY) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2
}

function meanSquaredError(points: XY[], predict: (point: XY) => number) {
  return points.reduce((sum, point) => sum + (point.y - predict(point)) ** 2, 0) / points.length
}

// -------------------------------------------------------------
// 6. NEW LAB: NEURAL ACTIVATIONS & GRADIENT FLOW LAB
// -------------------------------------------------------------
type ActivationType = 'sigmoid' | 'relu' | 'tanh' | 'gelu' | 'leaky_relu'

function ActivationLab() {
  const [func, setFunc] = useState<ActivationType>('sigmoid')
  const [weight, setWeight] = useState(1.5)
  const [bias, setBias] = useState(0.0)
  const [inputValue, setInputValue] = useState(1.0)

  const z = weight * inputValue + bias

  const computeActivation = (val: number, type: ActivationType) => {
    switch (type) {
      case 'sigmoid':
        return 1 / (1 + Math.exp(-val))
      case 'relu':
        return Math.max(0, val)
      case 'tanh':
        return Math.tanh(val)
      case 'gelu': {
        const c = Math.sqrt(2 / Math.PI)
        return 0.5 * val * (1 + Math.tanh(c * (val + 0.044715 * Math.pow(val, 3))))
      }
      case 'leaky_relu':
        return val >= 0 ? val : 0.1 * val
    }
  }

  const computeDerivative = (val: number, type: ActivationType) => {
    switch (type) {
      case 'sigmoid': {
        const s = 1 / (1 + Math.exp(-val))
        return s * (1 - s)
      }
      case 'relu':
        return val > 0 ? 1 : 0
      case 'tanh': {
        const t = Math.tanh(val)
        return 1 - t * t
      }
      case 'gelu': {
        // Approximate derivative via finite difference
        const eps = 1e-4
        return (computeActivation(val + eps, 'gelu') - computeActivation(val - eps, 'gelu')) / (2 * eps)
      }
      case 'leaky_relu':
        return val >= 0 ? 1 : 0.1
    }
  }

  const activationValue = computeActivation(z, func)
  const gradientValue = computeDerivative(z, func)

  // Generate curve from -5 to +5
  const curveData = Array.from({ length: 51 }, (_, i) => {
    const xVal = -5 + i * 0.2
    return {
      z: Number(xVal.toFixed(1)),
      activation: Number(computeActivation(xVal, func).toFixed(3)),
      derivative: Number(computeDerivative(xVal, func).toFixed(3)),
    }
  })

  const isVanishing = Math.abs(gradientValue) < 0.05
  const isDyingRelu = func === 'relu' && z <= 0

  return (
    <LabFrame
      kicker="DEEP LEARNING DYNAMICS"
      title="Activation functions and the vanishing gradient."
      chart={
        <>
          <ChartLegend
            items={[
              { label: 'Activation f(z)', className: 'legend-line-model' },
              { label: 'Derivative f’(z)', className: 'legend-cluster-4' },
            ]}
          />
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="z" name="Pre-activation z" tickLine={false} axisLine={false} />
                <YAxis name="Value" domain={[-1.2, 2.5]} tickLine={false} axisLine={false} />
                <Tooltip />
                <ReferenceLine x={z} stroke="var(--chart-point)" strokeWidth={1.5} strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="var(--chart-muted)" />
                <Line dataKey="activation" type="monotone" stroke="var(--chart-line)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
                <Line dataKey="derivative" type="monotone" stroke="var(--cluster-four)" strokeWidth={1.8} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="metric-pair">
            <span>INPUT SIGNAL z = w*x + b <b>{z.toFixed(2)}</b></span>
            <span>LOCAL GRADIENT da/dz <b>{gradientValue.toFixed(3)}</b></span>
          </div>
        </>
      }
      controls={
        <>
          <div className="add-point-controls">
            <span className="control-caption">SELECT ACTIVATION FUNCTION</span>
            <div className="class-switch" style={{ flexWrap: 'wrap' }}>
              {(['sigmoid', 'relu', 'tanh', 'gelu', 'leaky_relu'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={func === t ? 'class-selected class-b' : ''}
                  onClick={() => setFunc(t)}
                  style={{ textTransform: 'uppercase', minWidth: '55px', margin: '2px 0' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <LabSlider label="Input signal x" value={inputValue} min={-4} max={4} step={0.2} onChange={setInputValue} description="Raw feature input or incoming node representation." />
          <LabSlider label="Synaptic weight w" value={weight} min={0.1} max={3.0} step={0.1} onChange={setWeight} format={(v) => v.toFixed(1)} description="Multiplicative connection strength." />
          <LabSlider label="Bias term b" value={bias} min={-3} max={3} step={0.5} onChange={setBias} format={(v) => v.toFixed(1)} description="Scalar offset adjusting threshold position." />

          <div className="live-equation">
            a = <b>{activationValue.toFixed(3)}</b> <span>·</span> grad = <b>{gradientValue.toFixed(3)}</b>
          </div>

          {isDyingRelu && (
            <div className="playground-alert alert-danger">
              ⚠️ <b>Dying ReLU Detected!</b> Input z ≤ 0. The output is exactly 0 and gradient is 0. This neuron cannot learn or recover unless other data shifts it.
            </div>
          )}

          {isVanishing && !isDyingRelu && (
            <div className="playground-alert alert-warning">
              ⚠️ <b>Vanishing Gradient Zone!</b> The gradient is {gradientValue.toFixed(4)}. When chained across multiple deep layers, backprop error signals evaporate to 0.
            </div>
          )}

          <ResetButton onClick={() => { setFunc('sigmoid'); setWeight(1.5); setBias(0); setInputValue(1) }} />
        </>
      }
      explanation="Move the input and weights to see how activation and its derivative react. In Sigmoid and Tanh, extreme inputs saturate the curve where derivative drops toward zero (vanishing gradient). ReLU keeps gradient equal to 1 for positive inputs, solving vanishing gradients in deep feedforward architectures."
      learningMaterial={{
        formula: 'σ(z) = 1 / (1 + e^{-z}) ⟹ dσ/dz = σ(z)(1 - σ(z)) ≤ 0.25',
        concept:
          'Activation functions introduce non-linearity into neural networks. Without them, a multi-layer deep network collapses mathematically into a single linear regression. Because Sigmoid derivatives peak at only 0.25, multiplying derivatives across 10 layers yields 0.25¹⁰ ≈ 9.5 × 10⁻⁷, causing gradients to vanish completely.',
        experiments: [
          'Choose Sigmoid and set x = 3, w = 2.0: observe how derivative drops to ~0.002. Any gradient arriving at this layer will vanish.',
          'Switch to ReLU with positive input: the derivative is exactly 1.0, preserving gradient strength throughout backpropagation.',
          'Try GELU: observe the smooth non-monotonic curve around zero—this is the modern activation used in GPT, BERT, and Llama.',
        ],
        code: `import torch
import torch.nn as nn

class ModernMLPBlock(nn.Module):
    def __init__(self, dim, hidden_dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, hidden_dim)
        # GELU: Gaussian Error Linear Unit (standard for Transformers)
        self.act = nn.GELU()
        self.fc2 = nn.Linear(hidden_dim, dim)
        self.norm = nn.LayerNorm(dim)
        
    def forward(self, x):
        residual = x
        x = self.norm(x)
        x = self.fc2(self.act(self.fc1(x)))
        return x + residual  # Residual shortcut prevents vanishing gradients`,
        pitfalls:
          'Never use Sigmoid or Tanh activations in deep hidden layers. Use ReLU or GELU combined with LayerNorm/BatchNorm and residual skip connections to ensure gradient signals propagate cleanly across hundreds of layers.',
      }}
    />
  )
}

// -------------------------------------------------------------
// 7. NEW LAB: TRANSFORMER SELF-ATTENTION SIMULATOR
// -------------------------------------------------------------
const sampleTokens = ['The', 'transformer', 'model', 'learned', 'rich', 'attention']

// Pre-computed semantic dot products between tokens (Q * K^T)
const baseDotProducts: Record<string, number[]> = {
  The: [2.5, 0.8, 1.2, 0.4, 0.6, 0.9],
  transformer: [1.1, 4.8, 3.9, 2.1, 2.6, 4.2],
  model: [0.9, 3.8, 4.5, 2.8, 2.4, 3.7],
  learned: [0.5, 2.2, 2.9, 4.9, 3.1, 2.8],
  rich: [0.4, 1.8, 2.1, 2.5, 4.7, 3.8],
  attention: [0.8, 4.4, 3.6, 2.7, 3.5, 5.2],
}

function AttentionLab() {
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(1) // "transformer"
  const [temperature, setTemperature] = useState(1.0) // sqrt(d_k) scaling

  const currentToken = sampleTokens[selectedTokenIdx]
  const rawScores = baseDotProducts[currentToken] ?? [1, 1, 1, 1, 1, 1]

  // Scaled dot product: score / temperature
  const scaledScores = rawScores.map((s) => s / Math.max(0.2, temperature))

  // Softmax
  const maxScaled = Math.max(...scaledScores)
  const expScores = scaledScores.map((s) => Math.exp(s - maxScaled))
  const expSum = expScores.reduce((a, b) => a + b, 0)
  const attentionWeights = expScores.map((e) => e / expSum)

  const chartData = sampleTokens.map((token, index) => ({
    token,
    raw: Number(rawScores[index].toFixed(2)),
    weight: Number((attentionWeights[index] * 100).toFixed(1)),
    isSelf: index === selectedTokenIdx,
  }))

  return (
    <LabFrame
      kicker="TRANSFORMER ARCHITECTURE"
      title="How tokens attend to each other."
      chart={
        <>
          <ChartLegend
            items={[
              { label: 'Attention Weight (%)', className: 'legend-class-b' },
              { label: 'Query Token', className: 'legend-class-a' },
            ]}
          />
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="token" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                <Tooltip />
                <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isSelf ? 'var(--orange)' : 'var(--green)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-axis-labels">
            <span>TOKENS IN SEQUENCE →</span>
            <span>CURRENT QUERY: <b>"{currentToken}"</b></span>
          </div>
        </>
      }
      controls={
        <>
          <div className="add-point-controls">
            <span className="control-caption">CHOOSE QUERY TOKEN Q</span>
            <div className="class-switch" style={{ flexWrap: 'wrap' }}>
              {sampleTokens.map((tok, idx) => (
                <button
                  key={tok}
                  type="button"
                  className={selectedTokenIdx === idx ? 'class-selected class-a' : ''}
                  onClick={() => setSelectedTokenIdx(idx)}
                  style={{ margin: '2px 0' }}
                >
                  "{tok}"
                </button>
              ))}
            </div>
          </div>

          <LabSlider
            label="Scale Factor · √d_k"
            value={temperature}
            min={0.3}
            max={3.0}
            step={0.1}
            onChange={setTemperature}
            format={(v) => v.toFixed(1)}
            description="The scaling denominator. Lower values sharpen attention onto top matches; higher values diffuse it."
          />

          <div className="live-equation">
            top match: <b>{chartData.reduce((prev, cur) => (cur.weight > prev.weight ? cur : prev)).token}</b> (
            {Math.max(...chartData.map((d) => d.weight))}%)
          </div>

          <p className="control-note">
            Softmax turns dot products into a valid probability distribution summing to 100%. The output representation is the weighted sum of Value vectors.
          </p>

          <ResetButton onClick={() => { setSelectedTokenIdx(1); setTemperature(1.0) }} />
        </>
      }
      explanation="Click different words to see what each token pays attention to. When 'transformer' is the query, it attends strongly to 'model' and 'attention'. Notice how decreasing the scale factor sharpens attention like an argmax, while increasing it flattens the distribution."
      learningMaterial={{
        formula: 'Attention(Q, K, V) = softmax((Q * K^T) / √d_k) * V',
        concept:
          'Self-attention allows every word in an input sequence to dynamically route information from every other word regardless of distance. Queries (Q) express what information a token seeks; Keys (K) represent what each token offers; Values (V) contain the actual content that gets aggregated.',
        experiments: [
          'Select the word "attention": notice its strongest attention links point to "transformer" and "model".',
          'Drag the Scale Factor down to 0.4: observe how Softmax polarizes into an almost binary 100% focus on the single highest dot product.',
          'Drag Scale Factor up to 3.0: notice attention diffuses evenly across all words. Vaswani et al. introduced division by √d_k specifically to keep dot products in regions where Softmax gradients remain healthy.',
        ],
        code: `import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    # Q, K, V shape: [batch_size, num_heads, seq_len, d_k]
    d_k = Q.size(-1)
    
    # 1. Compute dot-product affinity matrix
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)
    
    # 2. Apply causal mask (optional, for decoder LLMs)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
        
    # 3. Softmax along key dimension
    attention_weights = F.softmax(scores, dim=-1)
    
    # 4. Aggregate values
    output = torch.matmul(attention_weights, V)
    return output, attention_weights`,
        pitfalls:
          'Without the 1/√d_k scaling factor, large head dimensions (e.g. d_k = 128) push dot-product values into extreme magnitudes where the Softmax function has vanishingly small gradients, causing multi-head attention training to stall completely.',
      }}
    />
  )
}
