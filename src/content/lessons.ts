export type LessonSection = {
  title: string
  kicker: string
  body: string
  kind?: 'prose' | 'math'
  points?: string[]
  example?: string
}

export type Lesson = {
  number: string
  slug: string
  title: string
  description: string
  module: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  estimatedMinutes: number
  prerequisites: string[]
  objectives: string[]
  analogy: string
  intro: string
  sections: LessonSection[]
  formula: string
  formulaExplanation: string
  code: string
  codeExplanation: string
  practice: { prompt: string; answer: string }[]
  quiz: { question: string; options: string[]; answer: number; explanation: string }
  takeaways: string[]
  interview: { question: string; answer: string }
  related: string[]
}

export const lessons: Lesson[] = [
  {
    number: '01', slug: 'what-is-machine-learning', title: 'What is machine learning?',
    description: 'A machine learns patterns from examples, then uses those patterns to make a useful guess about something it has not seen before.',
    module: 'ML foundations', difficulty: 'Beginner', estimatedMinutes: 9, prerequisites: [],
    objectives: ['Distinguish a rule-based program from a learned model.', 'Name the role of examples, patterns, and predictions.', 'Explain why a model must be checked on new examples.'],
    analogy: 'Teaching someone to recognize ripe fruit: you show examples and explain the useful cues, rather than writing a rule for every possible fruit.',
    intro: 'Machine learning (ML) is a way to make software improve at a task by finding patterns in examples. Instead of writing every decision by hand, we choose a learning method, provide data, and measure how well its predictions match what happened.',
    sections: [
      { title: 'Why learn from data?', kicker: 'THE PROBLEM IT SOLVES', body: 'Some tasks have too many cases or too many subtle clues for a person to list as rules. Spam changes its wording; photos contain objects in countless positions. A learned model can summarize recurring patterns from examples and apply them to new cases.', points: ['The examples are called data.', 'The pattern stored after training is the model.', 'Using the model to produce an answer is inference.'] },
      { title: 'A learning loop', kicker: 'STEP BY STEP', body: 'First choose the task and collect examples. A training algorithm adjusts the model so its predictions better match the examples. We then test on data the model did not train on. That last step matters: remembering examples is not the same as learning a useful pattern.', example: 'For email spam, each example is an email. Words and sender features are inputs. “Spam” or “not spam” is the known answer. The model learns associations, then predicts a label for a new email.' },
      { title: 'What ML does not promise', kicker: 'A NECESSARY CAVEAT', body: 'A model does not understand a task the way a person does. Its output depends on its training data, objective, and assumptions. Biased or incomplete examples can produce unreliable results; a strong score alone does not establish fairness or safety.', kind: 'math' },
    ],
    formula: '\\hat{y} = f_{\\theta}(x)', formulaExplanation: 'x is the input, f is the model, θ (theta) is what the training process learned, and ŷ (y-hat) is the model’s prediction.',
    code: 'examples = [\n    ("urgent: claim your prize", "spam"),\n    ("team meeting at 2 pm", "not spam"),\n]\n\n# A trained model uses patterns from examples\nnew_email = "claim your free prize"\nprediction = model.predict([new_email])\nprint(prediction[0])',
    codeExplanation: 'The examples pair an input with a known label. Training happens before this snippet. `predict` applies the trained model to a new input; it returns a guess, not a guarantee.',
    practice: [
      { prompt: 'A developer writes a fixed rule: if a message contains “free money,” flag it. Is that machine learning?', answer: 'Not by itself. The behavior is explicitly programmed as a rule. ML would fit patterns from examples using a training procedure.' },
      { prompt: 'Why keep some examples out of training?', answer: 'They provide an independent check of how well the learned pattern transfers to cases the model did not see while fitting.' },
      { prompt: 'For house-price prediction, name one input and one predicted output.', answer: 'Floor area is an input feature; estimated sale price is the output prediction.' },
    ],
    quiz: { question: 'What makes a program a machine-learning system?', options: ['It has many lines of code', 'It uses examples to fit a model that makes predictions', 'It always uses a neural network'], answer: 1, explanation: 'ML is defined by learning useful patterns from data, not by code size or by a particular kind of model.' },
    takeaways: ['ML learns patterns from examples instead of relying only on hand-written rules.', 'A trained model makes predictions on inputs it has not necessarily seen.', 'Testing on held-out data checks generalization, not human-like understanding.'],
    interview: { question: 'How would you explain machine learning to a non-technical person?', answer: 'It is a way to make software infer useful patterns from examples. We give it examples with relevant feedback, let a learning algorithm adjust a model, and evaluate the result on new cases before trusting it.' },
    related: ['supervised-vs-unsupervised', 'train-validation-test'],
  },
  {
    number: '02', slug: 'supervised-vs-unsupervised', title: 'Supervised vs. unsupervised learning',
    description: 'The difference is whether your examples come with answers. That one distinction changes the question your model can answer.',
    module: 'ML foundations', difficulty: 'Beginner', estimatedMinutes: 11, prerequisites: ['what-is-machine-learning'],
    objectives: ['Identify features and labels in a dataset.', 'Contrast supervised prediction with unsupervised structure-finding.', 'Choose a learning setup for a real task.'],
    analogy: 'Supervised learning is practicing with an answer key. Unsupervised learning is arranging a box of mixed buttons by resemblance without being told the categories.',
    intro: 'A learning setup describes what information is available while a model learns. In supervised learning, examples include a target answer. In unsupervised learning, there is no target label; the goal is to find structure in the inputs.',
    sections: [
      { title: 'The answer key: supervised learning', kicker: 'FEATURES + LABELS', body: 'Each row has inputs (features) and a target (label). A model learns a mapping from features to targets. Predicting a number is regression; choosing a category is classification.', points: ['Features describe the example, such as house size.', 'A label is the answer to predict, such as a price or spam category.', 'Training compares predictions with known labels.'] },
      { title: 'Finding structure: unsupervised learning', kicker: 'INPUTS WITHOUT LABELS', body: 'The examples have features but no known target answer. A clustering method might group customers with similar behavior. Dimensionality reduction can compress many measurements into fewer coordinates for inspection.', example: 'A shop has purchase histories but no customer segments. Clustering can suggest groups with similar patterns; a person still needs to check whether those groups are meaningful and useful.' },
      { title: 'Choose by the question', kicker: 'WHEN TO USE WHICH', body: 'If you have an outcome to predict and reliable examples of it, supervised learning is a natural starting point. If you want to explore similarities without known answers, unsupervised methods may help. They do not discover objectively correct labels automatically.', kind: 'math' },
    ],
    formula: '\\text{supervised: } (x_i, y_i) \\qquad \\text{unsupervised: } x_i', formulaExplanation: 'xᵢ is the feature vector for example i. yᵢ is its known target. Supervised data includes both; unsupervised data supplies xᵢ alone.',
    code: 'from sklearn.cluster import KMeans\nfrom sklearn.linear_model import LinearRegression\n\n# Known targets: learn to predict a price\nmodel = LinearRegression().fit(house_features, prices)\n\n# No target labels: group similar customers\ngroups = KMeans(n_clusters=3, random_state=7)\nlabels = groups.fit_predict(customer_features)',
    codeExplanation: '`fit` learns from the supplied examples. The regression model sees features and known prices. K-means sees only customer features and assigns a cluster index; the index is not a pre-existing ground-truth category.',
    practice: [
      { prompt: 'You have photos each labeled “cat” or “dog.” Which setup fits?', answer: 'Supervised classification: the photos are inputs and the labels are known target categories.' },
      { prompt: 'A bank wants to explore spending patterns without existing customer categories. What might help?', answer: 'An unsupervised clustering method can suggest groups, which should then be inspected for usefulness.' },
      { prompt: 'Is an automatically assigned cluster number a meaningful label?', answer: 'Not necessarily. Cluster IDs are arbitrary identifiers; interpretability requires examining the examples and context.' },
    ],
    quiz: { question: 'What is the key difference between supervised and unsupervised learning?', options: ['One uses more data', 'Supervised examples include known target answers', 'Unsupervised learning cannot use Python'], answer: 1, explanation: 'Supervised learning has target labels during training. Unsupervised methods work from inputs without a provided target answer.' },
    takeaways: ['Supervised learning uses examples paired with targets.', 'Unsupervised learning searches for structure without target labels.', 'Clusters are hypotheses about structure, not guaranteed truths.'],
    interview: { question: 'Can clustering be used when the final goal is prediction?', answer: 'Sometimes as an exploratory tool or as a feature-generation step, but clusters alone do not provide supervised target labels. Validate that they help the downstream task using a proper split.' },
    related: ['what-is-machine-learning', 'linear-regression'],
  },
  {
    number: '03', slug: 'linear-regression', title: 'Linear regression, from line to prediction',
    description: 'Learn how a straight line turns a measurement into a prediction, and what “best fit” actually means.',
    module: 'Supervised learning', difficulty: 'Beginner', estimatedMinutes: 14, prerequisites: ['supervised-vs-unsupervised'],
    objectives: ['Interpret slope and intercept.', 'Calculate a prediction and residual.', 'Explain least squares and a key limitation.'],
    analogy: 'Lay a ruler through a cloud of points. The line cannot touch every point, so we choose one that keeps the vertical misses small overall.',
    intro: 'Linear regression predicts a numeric value by combining input features with learned weights. With one feature, its prediction is a line. It is a useful baseline because its assumptions and mistakes are relatively easy to inspect.',
    sections: [
      { title: 'A line with a job', kicker: 'SLOPE + INTERCEPT', body: 'The slope says how much the prediction changes for a one-unit increase in x. The intercept is the predicted value at x = 0. With several features, each feature gets a weight and the model adds their contributions.', example: 'If a fitted study-score line is ŷ = 5x + 40, then 4 practice hours predict 60 points. The slope is 5 points per hour; this is a model association, not proof that each hour causes a five-point gain.' },
      { title: 'Misses become a score', kicker: 'RESIDUALS + LEAST SQUARES', body: 'A residual is the actual value minus the prediction. Least squares chooses weights that minimize the sum of squared residuals. Squaring prevents positive and negative misses from cancelling and penalizes large misses more strongly.', points: ['Residual: actual − predicted.', 'Large errors count disproportionately after squaring.', 'Outliers can therefore pull a least-squares line toward them.'] },
      { title: 'A useful baseline, not a law of nature', kicker: 'ASSUMPTIONS TO CHECK', body: 'The relationship should be reasonably linear over the range of use. Data points should not be treated as independent when they are linked, and residual patterns should be inspected. Extrapolating far beyond observed examples is especially risky.', kind: 'math' },
    ],
    formula: '\\hat{y} = wx + b \\qquad J(w,b) = \\frac{1}{n}\\sum_{i=1}^{n}(y_i - (wx_i+b))^2', formulaExplanation: 'w is slope, b is intercept, and the second expression is mean squared error (MSE): the average squared difference between actual y and predicted ŷ.',
    code: 'import numpy as np\nfrom sklearn.linear_model import LinearRegression\n\n# Hours studied and observed exam scores\nX = np.array([[1], [2], [3], [4]])\ny = np.array([47, 52, 61, 66])\n\nmodel = LinearRegression().fit(X, y)\nprediction = model.predict([[5]])[0]\nprint(f"slope={model.coef_[0]:.1f}, predicted={prediction:.1f}")',
    codeExplanation: 'Scikit-learn expects a two-dimensional feature array: rows are examples and columns are features. `fit` estimates the line from the four observations; `predict` estimates the score for five study hours.',
    practice: [
      { prompt: 'For ŷ = 3x + 7, what does the slope mean?', answer: 'The predicted y increases by 3 units for each one-unit increase in x, within the range where the line is a reasonable model.' },
      { prompt: 'A house sold for 320,000 and the model predicted 300,000. What is the residual?', answer: 'Actual minus predicted is 20,000. The model underpredicted this sale by 20,000.' },
      { prompt: 'Why can one outlier move a least-squares line substantially?', answer: 'Squared errors give large residuals much more influence than small ones, so an outlier can dominate the objective.' },
    ],
    quiz: { question: 'What does the slope mean in a one-feature linear model?', options: ['The average training error', 'The predicted change in y for a one-unit increase in x', 'The number of training examples'], answer: 1, explanation: 'Slope is the model’s rate of change with respect to x; it is not automatically a causal effect.' },
    takeaways: ['Linear regression predicts a number by adding weighted feature contributions.', 'Least squares minimizes squared residuals.', 'Check fit assumptions and avoid ungrounded extrapolation.'],
    interview: { question: 'What does the coefficient in linear regression tell you?', answer: 'Holding other modeled features fixed, it gives the model’s predicted change in the target for a one-unit change in that feature. Interpretation depends on scaling, feature relationships, and assumptions; it is not by itself a causal claim.' },
    related: ['gradient-descent', 'train-validation-test'],
  },
  {
    number: '04', slug: 'train-validation-test', title: 'Train, validation, and test data',
    description: 'Three data splits, three different jobs. Get this boundary right before trusting a score.',
    module: 'ML foundations', difficulty: 'Beginner', estimatedMinutes: 12, prerequisites: ['what-is-machine-learning'],
    objectives: ['Describe the purpose of each split.', 'Recognize test-set leakage.', 'Choose a split strategy that reflects deployment.'],
    analogy: 'Training is practice, validation is the mock exam you use to adjust your study plan, and the test is the final exam you open once.',
    intro: 'A model’s training score measures fit to examples it has already used. To estimate how it will behave on new cases, we hold data aside. The names train, validation, and test refer to different jobs, not different kinds of examples.',
    sections: [
      { title: 'Three jobs, three boundaries', kicker: 'THE DIVISION OF LABOR', body: 'Training data fits model parameters. Validation data compares choices such as model complexity or regularization. Test data estimates final performance after decisions are finished.', points: ['Do not tune the model based on repeated test results.', 'Fit preprocessing steps on training data only.', 'Keep examples from the same person or event together when needed.'] },
      { title: 'Match the split to reality', kicker: 'THE RIGHT SPLIT DEPENDS ON THE TASK', body: 'Random splitting is often reasonable for independent, similarly distributed examples. For future forecasting, train on earlier times and test on later ones. For people with multiple records, split by person to prevent near-duplicates crossing the boundary.', example: 'If a model predicts next month’s demand, training on randomly selected days can let later-season patterns leak into training. A chronological split better approximates “learn from the past, predict the future.”' },
      { title: 'Preprocessing can leak too', kicker: 'A SUBTLE TRAP', body: 'If you scale features using the mean of the entire dataset, held-out information influenced training. Put scaling and other learned transformations inside a pipeline so they are fit on each training fold only.', kind: 'math' },
    ],
    formula: '\\text{fit on train} \\rightarrow \\text{choose on validation} \\rightarrow \\text{report once on test}', formulaExplanation: 'The arrows describe information flow. The test set should not influence model selection or preprocessing.',
    code: 'from sklearn.model_selection import train_test_split\nfrom sklearn.pipeline import make_pipeline\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.linear_model import LogisticRegression\n\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, stratify=y, random_state=7\n)\nmodel = make_pipeline(StandardScaler(), LogisticRegression())\nmodel.fit(X_train, y_train)\nprint("held-out accuracy:", model.score(X_test, y_test))',
    codeExplanation: 'The split happens before the pipeline is fitted. `stratify=y` keeps class proportions similar in both sets for classification. The scaler learns from training data through the pipeline, not from the held-out test examples.',
    practice: [
      { prompt: 'You try 40 model variants and choose the one with the best test score. What went wrong?', answer: 'The test set became part of model selection. Its score is now optimistically biased; use a validation set or cross-validation for those choices and reserve fresh test data for the final check.' },
      { prompt: 'For forecasting next week, should future records be randomly mixed into training?', answer: 'Usually no. A chronological split better reflects the actual prediction direction and reduces future-information leakage.' },
      { prompt: 'Where should a scaler be fitted?', answer: 'On the training data within a pipeline, so held-out examples do not influence the learned means and scales.' },
    ],
    quiz: { question: 'What is the main role of a validation set?', options: ['Fit the model weights', 'Choose between modeling decisions without touching the final test set', 'Increase the number of labels'], answer: 1, explanation: 'Validation data supports model selection. The test set remains untouched until those decisions are complete.' },
    takeaways: ['Training fits; validation guides choices; test estimates final generalization.', 'The split must reflect the independence and time structure of the task.', 'Preprocessing learned from data belongs inside the training pipeline.'],
    interview: { question: 'What is data leakage?', answer: 'Leakage is information available during training or selection that would not legitimately be available at prediction time. It can come from features, splitting, or preprocessing and creates overly optimistic evaluation.' },
    related: ['overfitting-underfitting', 'evaluation-metrics'],
  },
  {
    number: '05', slug: 'gradient-descent', title: 'Gradient descent: learning one step at a time',
    description: 'A small, repeated move in the direction that makes error smaller. That is the core idea behind a surprising amount of ML.',
    module: 'Optimization', difficulty: 'Beginner', estimatedMinutes: 13, prerequisites: ['linear-regression'],
    objectives: ['Read a gradient as a direction of change.', 'Apply one parameter update by hand.', 'Explain the role and risk of learning rate.'],
    analogy: 'Walking downhill in fog: feel the slope beneath your feet, take a step against the incline, and check the ground again.',
    intro: 'Many models learn parameters by minimizing a loss: a number that measures how wrong predictions are. Gradient descent uses the slope of that loss to update parameters repeatedly. It is an optimization method, not a guarantee of finding the global best answer.',
    sections: [
      { title: 'The gradient points uphill', kicker: 'FOLLOW THE SLOPE', body: 'A derivative tells how a quantity changes as a parameter changes. For many parameters, the gradient collects these derivatives. To reduce loss, move in the opposite direction from the gradient.', example: 'Suppose J(w) = (w − 3)² and we start at w = 0. The derivative is 2(w − 3) = −6. With learning rate 0.1, the update is w = 0 − 0.1(−6) = 0.6: closer to 3.' },
      { title: 'Learning rate: how big is a step?', kicker: 'A SMALL NUMBER WITH BIG CONSEQUENCES', body: 'A tiny learning rate makes small updates and can need many iterations. A very large one can hop over a good region and make loss oscillate or grow. There is no single best rate for every model and dataset.', points: ['Batch gradient descent uses all training examples per update.', 'Stochastic gradient descent uses one example per update.', 'Mini-batches trade noisy updates for efficient vectorized work.'] },
      { title: 'Read the loss curve', kicker: 'WHAT TO WATCH', body: 'A falling loss suggests progress on the optimized objective. It does not guarantee good held-out performance. If training loss falls while validation loss rises, the model may be overfitting; the update rule cannot fix a flawed evaluation setup.', kind: 'math' },
    ],
    formula: '\\theta_{t+1} = \\theta_t - \\alpha \\nabla J(\\theta_t)', formulaExplanation: 'θ is the parameter vector, α is the learning rate, and ∇J is the gradient of loss J. The minus sign moves opposite the gradient.',
    code: 'w = 0.0\nlearning_rate = 0.1\n\nfor step in range(20):\n    gradient = 2 * (w - 3)  # derivative of (w - 3) ** 2\n    w = w - learning_rate * gradient\n    if step in (0, 4, 19):\n        loss = (w - 3) ** 2\n        print(step + 1, round(w, 3), round(loss, 3))',
    codeExplanation: 'The derivative tells whether increasing w raises or lowers the loss. Subtracting a fraction of the gradient updates w. The sequence approaches the minimum at w = 3; the learning rate controls how quickly.',
    practice: [
      { prompt: 'If the derivative is positive, which way does gradient descent move?', answer: 'It decreases the parameter, because it subtracts a positive learning-rate-scaled gradient.' },
      { prompt: 'Starting at w = 0 with J(w) = (w − 3)² and learning rate 0.1, find the next w.', answer: 'The gradient is −6, so w_new = 0 − 0.1(−6) = 0.6.' },
      { prompt: 'What might an excessively large learning rate look like?', answer: 'Loss may jump around, oscillate, or increase because updates repeatedly step past a low-loss region.' },
    ],
    quiz: { question: 'Why does gradient descent subtract the gradient?', options: ['The gradient points in the direction of steepest local increase', 'Subtraction makes the dataset smaller', 'The gradient is always a negative number'], answer: 0, explanation: 'The gradient points uphill locally. Subtracting it takes a step in the direction of steepest local decrease.' },
    takeaways: ['The gradient describes local loss change with respect to parameters.', 'Gradient descent updates parameters opposite that gradient.', 'Learning rate controls step size and can make training too slow or unstable.'],
    interview: { question: 'What happens if the learning rate is too high or too low?', answer: 'Too low can make optimization painfully slow. Too high can cause overshooting, oscillation, or divergence. Inspecting training curves and tuning the rate are practical first steps.' },
    related: ['linear-regression', 'neural-networks'],
  },
  {
    number: '06', slug: 'overfitting-underfitting', title: 'Overfitting and underfitting',
    description: 'A model can memorize the practice questions or fail to learn the subject. Generalization is the skill in between.',
    module: 'Model quality', difficulty: 'Beginner', estimatedMinutes: 10, prerequisites: ['train-validation-test'],
    objectives: ['Distinguish underfit from overfit behavior.', 'Interpret training and validation errors together.', 'Name practical ways to improve generalization.'],
    analogy: 'A student who memorizes exact answer keys struggles with new questions. One who never grasps the basics struggles with both practice and exam questions.',
    intro: 'The real goal is not to fit the training examples perfectly. It is to learn patterns that remain useful on new examples drawn from the task we care about. Underfitting and overfitting are two ways that goal can fail.',
    sections: [
      { title: 'Too simple: underfitting', kicker: 'HIGH ERROR EVERYWHERE', body: 'An underfit model cannot capture important structure. Training and validation errors are both high. A more expressive model, better features, or more training may help, provided the data and objective are appropriate.' },
      { title: 'Too specific: overfitting', kicker: 'A GAP OPENS UP', body: 'An overfit model matches training details that do not repeat reliably. Training error can be low while validation error is much higher. More data, regularization, a simpler model, or early stopping can reduce this gap.', points: ['Compare training and validation performance.', 'Use the same evaluation procedure when comparing models.', 'Do not keep tuning against the test set.'] },
      { title: 'A model is not the only culprit', kicker: 'CHECK THE EVIDENCE', body: 'A train/validation gap can also reflect a poor split, a distribution shift, or leakage. Diagnose before reaching for a regularizer. Ask whether both sets represent the cases the model will actually see.', kind: 'math' },
    ],
    formula: '\\text{generalization gap} = \\text{validation error} - \\text{training error}', formulaExplanation: 'A large positive gap can signal overfitting, but only when the split and metrics are meaningful for the task.',
    code: 'from sklearn.tree import DecisionTreeClassifier\nfrom sklearn.metrics import accuracy_score\n\nfor depth in (1, 3, 12, None):\n    model = DecisionTreeClassifier(max_depth=depth, random_state=7)\n    model.fit(X_train, y_train)\n    train_score = accuracy_score(y_train, model.predict(X_train))\n    valid_score = accuracy_score(y_valid, model.predict(X_valid))\n    print(depth, round(train_score, 2), round(valid_score, 2))',
    codeExplanation: 'The training score measures fit to examples used for training. The validation score helps compare model complexity. A very deep tree may fit training data extremely well without improving validation performance.',
    practice: [
      { prompt: 'Training error and validation error are both high. What is a likely issue?', answer: 'Underfitting is plausible: the model may be too simple, features may be inadequate, or the task may need a better representation.' },
      { prompt: 'Training error is low and validation error is much higher. What should you investigate?', answer: 'Overfitting is one possibility. Also check split quality, leakage, distribution differences, and whether the validation set is representative.' },
      { prompt: 'Name two ways to reduce overfitting.', answer: 'Examples include simplifying the model, adding regularization, gathering more representative data, or using early stopping.' },
    ],
    quiz: { question: 'Which pattern is most consistent with overfitting?', options: ['High train error and high validation error', 'Low train error with substantially higher validation error', 'Low error on every new example forever'], answer: 1, explanation: 'The train/validation gap suggests the model fits training-specific details that do not transfer as well.' },
    takeaways: ['Underfitting means the model misses important patterns.', 'Overfitting means training performance does not carry over well.', 'Diagnose splits and distributions before changing model complexity.'],
    interview: { question: 'How can you detect overfitting?', answer: 'Compare training and validation performance with a sound split. A large gap where training is much better is a warning signal. Also inspect learning curves and check for leakage or distribution mismatch.' },
    related: ['train-validation-test', 'evaluation-metrics'],
  },
  {
    number: '07', slug: 'evaluation-metrics', title: 'Evaluation metrics: what does “good” mean?',
    description: 'A score only makes sense when it reflects the mistake you care about. Start with the question, then choose the metric.',
    module: 'Model quality', difficulty: 'Beginner', estimatedMinutes: 13, prerequisites: ['train-validation-test'],
    objectives: ['Read a binary confusion matrix.', 'Calculate precision and recall.', 'Explain when accuracy is a misleading summary.'],
    analogy: 'A smoke alarm should catch fires, but a system that rings all day is not useful either. Which mistake matters more depends on the setting.',
    intro: 'A metric compresses model behavior into a number. Compression is useful for comparison, but it hides detail. Before choosing a metric, decide which errors are costly and what decisions the score will support.',
    sections: [
      { title: 'Count the kinds of mistakes', kicker: 'THE CONFUSION MATRIX', body: 'For binary classification, true positives are positive cases correctly flagged; false positives are negative cases incorrectly flagged. False negatives miss positive cases. True negatives correctly reject negatives.', example: 'In 1,000 transactions with 10 fraud cases, a model that predicts “not fraud” every time is 99% accurate, but catches zero fraud. Accuracy concealed the failure that mattered.' },
      { title: 'Precision and recall ask different questions', kicker: 'WHEN FALSE ALARMS MEET MISSED CASES', body: 'Precision asks: of the cases flagged positive, how many were truly positive? Recall asks: of all true positive cases, how many did we find? Raising one can lower the other when the decision threshold changes.', points: ['Precision = TP / (TP + FP).', 'Recall = TP / (TP + FN).', 'F1 is their harmonic mean; it is not automatically the right business objective.'] },
      { title: 'Choose a metric from the use case', kicker: 'MAKE THE TRADE-OFF EXPLICIT', body: 'For a screening tool, missing a serious case may be worse than a follow-up check, so recall may matter. For an expensive intervention, false alarms may be costly, so precision matters. Use a precision-recall curve when positive cases are rare.', kind: 'math' },
    ],
    formula: '\\text{precision}=\\frac{TP}{TP+FP} \\qquad \\text{recall}=\\frac{TP}{TP+FN}', formulaExplanation: 'TP means true positives, FP false positives, and FN false negatives. Each denominator describes the population relevant to that question.',
    code: 'from sklearn.metrics import (\n    confusion_matrix, precision_score, recall_score, f1_score\n)\n\nactual = [1, 1, 0, 0, 0, 0]\npredicted = [1, 0, 0, 0, 1, 0]\n\nprint(confusion_matrix(actual, predicted))\nprint("precision:", precision_score(actual, predicted))\nprint("recall:", recall_score(actual, predicted))\nprint("F1:", f1_score(actual, predicted))',
    codeExplanation: 'The positive class is `1`. The model found one of two positives (recall 0.5) and one of its two positive predictions was correct (precision 0.5). Always confirm which class is treated as positive.',
    practice: [
      { prompt: 'A fraud model catches 8 of 10 fraud cases and flags 20 transactions, 8 of which are fraud. Find recall and precision.', answer: 'Recall is 8/10 = 0.8. Precision is 8/20 = 0.4.' },
      { prompt: 'Why is 99% accuracy weak evidence when only 1% of examples are positive?', answer: 'A model can predict the majority class every time and reach 99% accuracy while detecting none of the positive cases.' },
      { prompt: 'For an initial health screening where follow-up tests are available, which error may deserve extra attention?', answer: 'False negatives may be especially concerning, so recall is important. The actual choice requires clinical and operational context.' },
    ],
    quiz: { question: 'Recall measures which fraction?', options: ['Predicted positives that are correct', 'Actual positives that the model found', 'All predictions that are correct'], answer: 1, explanation: 'Recall divides true positives by all actual positives (TP + FN), so it measures how many positives were found.' },
    takeaways: ['Metrics encode priorities; no single score describes every failure.', 'Accuracy can hide poor performance on a rare class.', 'Precision and recall focus on different error costs.'],
    interview: { question: 'When might you prefer recall over precision?', answer: 'When missing a true positive is more costly than investigating a false alarm, such as an early screening stage. The decision threshold and follow-up capacity still matter.' },
    related: ['overfitting-underfitting', 'train-validation-test'],
  },
  {
    number: '08', slug: 'neural-networks', title: 'Neural networks: layers of learned features',
    description: 'A network is a composition of simple functions. Its power comes from learning useful intermediate representations.',
    module: 'Deep learning', difficulty: 'Beginner', estimatedMinutes: 15, prerequisites: ['linear-regression', 'gradient-descent'],
    objectives: ['Describe weights, biases, and activations.', 'Trace a tiny forward pass.', 'Explain why nonlinear activations matter.'],
    analogy: 'A workshop passes a part through several stations. Each station measures and reshapes it; the final station makes the decision.',
    intro: 'A neural network is a function built from layers. Each layer combines its inputs with learned weights and biases, then often applies a nonlinear activation. Training adjusts those parameters to reduce a chosen loss.',
    sections: [
      { title: 'A neuron is a small calculation', kicker: 'WEIGHTS + BIAS + ACTIVATION', body: 'A unit multiplies inputs by weights, adds a bias, and applies an activation. ReLU returns zero for negative values and keeps positive ones. The weights determine which input patterns matter to the unit.', example: 'With inputs 2 and 1, weights 0.5 and −1, and bias 0.25, the pre-activation is 2(0.5) + 1(−1) + 0.25 = 0.25. ReLU leaves 0.25 unchanged.' },
      { title: 'Layers build representations', kicker: 'FROM INPUT TO OUTPUT', body: 'The first layer sees the raw features. Later layers receive transformed activations. Combining layers with nonlinear functions can represent relationships that a single linear map cannot. For an image, early layers may respond to simple edges; later layers can combine them into more complex patterns.', points: ['The forward pass computes a prediction.', 'A loss compares that prediction with the target.', 'Backpropagation computes parameter gradients for learning.'] },
      { title: 'The activation is not decoration', kicker: 'WHY NONLINEARITY MATTERS', body: 'Stacking linear transformations without nonlinear activations is still just one linear transformation. Nonlinearity lets layers compose richer functions. It also makes optimization and training behavior more complex, so architecture and data quality still matter.', kind: 'math' },
    ],
    formula: 'a = \\operatorname{ReLU}(w_1x_1 + w_2x_2 + b)', formulaExplanation: 'The inputs x₁ and x₂ are scaled by weights w₁ and w₂, shifted by bias b, and passed through ReLU: max(0, z).',
    code: 'import torch\nfrom torch import nn\n\nnetwork = nn.Sequential(\n    nn.Linear(2, 4),  # two inputs, four hidden units\n    nn.ReLU(),\n    nn.Linear(4, 1),  # one numeric prediction\n)\n\nfeatures = torch.tensor([[2.0, 1.0]])\nprediction = network(features)\nprint(prediction.shape)  # torch.Size([1, 1])',
    codeExplanation: 'The first linear layer maps two input values into four learned features. ReLU adds nonlinearity. The final layer combines those features into one number. The values are random until the network is trained.',
    practice: [
      { prompt: 'What does a bias add to a neuron?', answer: 'It shifts the weighted sum, allowing the unit’s response to change even when input values are zero.' },
      { prompt: 'Why use an activation between linear layers?', answer: 'Without nonlinear activations, any stack of linear layers collapses mathematically into one linear transformation.' },
      { prompt: 'Are random initial predictions meaningful?', answer: 'No. Before training, weights are initialized but have not yet been adjusted to learn the task.' },
    ],
    quiz: { question: 'What do nonlinear activations allow a multi-layer network to do?', options: ['Represent richer functions than a single linear map', 'Avoid needing training data', 'Guarantee perfect predictions'], answer: 0, explanation: 'Nonlinear activations make the composition more expressive; they do not guarantee accuracy or replace data.' },
    takeaways: ['A neuron computes a weighted sum, bias, and activation.', 'Layers transform inputs into learned intermediate representations.', 'Nonlinear activations let the network model nonlinear relationships.'],
    interview: { question: 'What happens if a neural network has no nonlinear activation functions?', answer: 'A composition of linear layers is still linear, so depth alone does not make the model more expressive than a single linear transformation.' },
    related: ['gradient-descent', 'evaluation-metrics'],
  },
]

export type CourseModule = {
  id: string
  number: string
  shortTitle: string
  title: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  estimatedHours: string
  lessonCount: number
  lessonSlugs: string[]
  description: string
  outcomes: string[]
}

export const modules: CourseModule[] = [
  { id: 'foundations', number: '01', shortTitle: 'ML foundations', title: 'Start with the shape of the problem', level: 'Beginner', estimatedHours: '2–3 hours', lessonCount: 3, lessonSlugs: ['what-is-machine-learning', 'supervised-vs-unsupervised', 'train-validation-test'], description: 'Get clear on what a model learns, what its data says, and how to tell whether a result means anything.', outcomes: ['Inputs & targets', 'Learning setups', 'Data splits'] },
  { id: 'supervised', number: '02', shortTitle: 'Supervised learning', title: 'Make a prediction you can explain', level: 'Beginner', estimatedHours: '3–4 hours', lessonCount: 1, lessonSlugs: ['linear-regression'], description: 'Build a first predictive model and understand the assumptions hiding inside its simplicity.', outcomes: ['Regression', 'Model assumptions', 'Residuals'] },
  { id: 'optimization', number: '03', shortTitle: 'Optimization', title: 'How a model learns its parameters', level: 'Beginner', estimatedHours: '3–5 hours', lessonCount: 1, lessonSlugs: ['gradient-descent'], description: 'Use derivatives and loss to understand the repeated updates behind model training.', outcomes: ['Loss functions', 'Gradients', 'Learning rate'] },
  { id: 'model-quality', number: '04', shortTitle: 'Model quality', title: 'Trust the evidence, not the headline score', level: 'Beginner', estimatedHours: '3–4 hours', lessonCount: 2, lessonSlugs: ['overfitting-underfitting', 'evaluation-metrics'], description: 'Diagnose model fit and choose evaluation measures that match the real cost of mistakes.', outcomes: ['Generalization', 'Classification metrics', 'Error costs'] },
  { id: 'deep-learning', number: '05', shortTitle: 'Deep learning', title: 'Build up from a single neuron', level: 'Beginner', estimatedHours: '5–7 hours', lessonCount: 1, lessonSlugs: ['neural-networks'], description: 'See neural networks as layered functions before reaching for a framework.', outcomes: ['Neurons & layers', 'Activations', 'Forward pass'] },
  { id: 'computer-vision', number: '06', shortTitle: 'Computer vision', title: 'Teach a model to see patterns', level: 'Intermediate', estimatedHours: '6–8 hours', lessonCount: 8, lessonSlugs: [], description: 'Move from pixels and convolution to image classification, detection, and segmentation.', outcomes: ['Image tensors', 'Convolutions', 'Transfer learning'] },
  { id: 'language-models', number: '07', shortTitle: 'Language & LLMs', title: 'From tokens to useful language tools', level: 'Intermediate', estimatedHours: '8–10 hours', lessonCount: 12, lessonSlugs: [], description: 'Understand text representations, attention, transformer architectures, and retrieval-augmented generation.', outcomes: ['Tokenization', 'Attention', 'RAG'] },
  { id: 'production', number: '08', shortTitle: 'Production AI', title: 'Bring models into the real world', level: 'Advanced', estimatedHours: '8–12 hours', lessonCount: 9, lessonSlugs: [], description: 'Explore deployment, evaluation, monitoring, and the operational choices that keep ML systems reliable.', outcomes: ['Serving', 'Monitoring', 'Responsible AI'] },
]
