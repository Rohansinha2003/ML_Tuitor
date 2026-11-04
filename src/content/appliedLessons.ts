import type { LessonDraft } from './lessons'

const py = String.raw

export const supervisedLessons: LessonDraft[] = [
  {
    slug: 'logistic-regression', title: 'Logistic regression: predicting a probability',
    description: 'Squash a linear score into a probability, then decide what to do with it. The most useful classifier to understand first.',
    module: 'Supervised learning', difficulty: 'Beginner', estimatedMinutes: 16, prerequisites: ['linear-regression'],
    objectives: ['Turn a linear score into a probability with the sigmoid.', 'Calculate log loss by hand and explain why it punishes confident errors.', 'Separate the model’s probability from the threshold used to act on it.'],
    analogy: 'Imagine a judge scoring evidence. Each clue adds or subtracts points, and the total can be any number. To be useful, the judge converts that total into a statement like “I am 88% sure.” Logistic regression is that conversion: a running score, then a dial that maps any score into a value between 0 and 1.',
    intro: 'Linear regression can predict 1.7 or −0.4, which makes no sense as a chance of passing an exam. Logistic regression keeps the same weighted sum but feeds it through the sigmoid function, which always returns a value between 0 and 1. Despite the name, it is a classification method. It is fast, easy to inspect, and a strong baseline: if a complex model cannot beat it, the complexity has not earned its place.',
    sections: [
      { title: 'From score to probability', kicker: 'THE SIGMOID', body: 'First compute a score z = wx + b, also called a logit. The sigmoid σ(z) = 1 / (1 + e⁻ᶻ) maps it into (0, 1). At z = 0 the output is exactly 0.5. Large positive scores approach 1 and large negative scores approach 0. The curve is steepest near zero, so examples near the boundary are the most sensitive to small changes in the score.', example: 'Let w = 1.5 and b = −4. For x = 2, z = 1.5(2) − 4 = −1 and σ(−1) ≈ 0.269. For x = 4, z = 1.5(4) − 4 = 2 and σ(2) ≈ 0.881. The same one-step formula produces a low probability for the first student and a high probability for the second.' },
      { title: 'Why not mean squared error?', kicker: 'LOG LOSS', body: 'Classification is trained with log loss, also called binary cross-entropy. For one example, the loss is −ln(p) when the true label is 1 and −ln(1 − p) when the true label is 0. A confident correct answer costs almost nothing, and a confident wrong answer costs a lot. Combined with the sigmoid, this loss is convex in the weights, so gradient descent has no bad local minima to get stuck in.', example: 'Suppose p = 0.881. If the true label is 1, the loss is −ln(0.881) ≈ 0.127. If the true label is 0, the loss is −ln(1 − 0.881) = −ln(0.119) ≈ 2.13. The confident mistake costs about seventeen times more than the correct answer earns.', points: ['Loss near 0 means a confident, correct prediction.', 'A prediction of 0.5 costs ln 2 ≈ 0.693 whichever label is true, a useful “knows nothing” reference for balanced classes.', 'Regularization is usually on by default; scikit-learn’s `C` is the inverse of its strength.'] },
      { title: 'Reading the weights', kicker: 'ODDS AND LOG-ODDS', body: 'The score z is the log of the odds: z = ln(p / (1 − p)). So increasing x by one unit adds w to the log-odds, which multiplies the odds by eʷ. With w = 1.5, each extra unit multiplies the odds by about 4.48. It does not add a fixed amount to the probability: the same step changes probability a lot near 0.5 and very little near 0 or 1.', points: ['A positive weight pushes toward class 1; a negative weight pushes toward class 0.', 'Compare weights only after putting features on comparable scales.', 'Correlated features can share or swap weight, so a coefficient is not a causal effect.'] },
      { title: 'Probability first, decision second', kicker: 'THE THRESHOLD', body: 'The model outputs a probability. Turning that into an action is a separate choice. The 0.5 default is only sensible when both kinds of mistake cost the same and classes are balanced. For cancer screening you might flag anything above 0.1, and for an expensive manual review you might require 0.9. Because the boundary sits where z = 0, one feature gives one cut point, x = −b / w, and several features give a flat hyperplane. If the real boundary is curved, add features or use another model.', kind: 'math', example: 'With w = 1.5 and b = −4, the 0.5 boundary is x = 4 / 1.5 ≈ 2.67. Raising the threshold to 0.9 requires z = ln(0.9 / 0.1) ≈ 2.2, so x ≈ (2.2 + 4) / 1.5 ≈ 4.13.' },
    ],
    formula: 'p = \\sigma(wx+b) = \\frac{1}{1+e^{-(wx+b)}} \\qquad L = -\\big[y\\ln p + (1-y)\\ln(1-p)\\big]', formulaExplanation: 'The first expression converts a linear score into a probability. The second is the log loss for one example: when y = 1 only the −ln p term remains, and when y = 0 only −ln(1 − p) remains. Training averages L across examples and minimizes it.',
    code: py`import numpy as np
from sklearn.linear_model import LogisticRegression

# Hours studied and whether each student passed (1) or not (0)
hours = np.array([[0.5], [1.0], [1.5], [2.0], [2.5], [3.0], [3.5], [4.0], [4.5], [5.0]])
passed = np.array([0, 0, 0, 0, 1, 0, 1, 1, 1, 1])

model = LogisticRegression().fit(hours, passed)
print(f"weight={model.coef_[0][0]:.2f}, bias={model.intercept_[0]:.2f}")

# predict_proba returns [P(class 0), P(class 1)] for each row
for h in (1.0, 2.5, 4.5):
    probability = model.predict_proba([[h]])[0][1]
    print(f"{h} hours -> P(pass)={probability:.2f}, label={int(probability >= 0.5)}")

# The decision boundary is where the score is zero
boundary = -model.intercept_[0] / model.coef_[0][0]
print(f"decision boundary at {boundary:.2f} hours")`,
    codeOutput: 'weight=1.22, bias=-3.37\n1.0 hours -> P(pass)=0.11, label=0\n2.5 hours -> P(pass)=0.42, label=0\n4.5 hours -> P(pass)=0.89, label=1\ndecision boundary at 2.75 hours',
    codeExplanation: '`predict_proba` returns one column per class, so `[0][1]` means first row, probability of class 1. The boundary formula −b / w comes from setting the score to zero. The fitted weight is smaller than the hand example’s because scikit-learn applies L2 regularization by default, which shrinks weights. Pass a larger `C` to weaken it. Use `predict_proba` and your own threshold when the costs of errors differ.',
    practice: [
      { prompt: 'With w = 2 and b = −6, what is the probability at x = 3, and at x = 4?', answer: '0.5 at x = 3 and about 0.881 at x = 4.', solution: 'At x = 3, z = 2(3) − 6 = 0 and σ(0) = 0.5, so x = 3 is on the boundary. At x = 4, z = 2(4) − 6 = 2 and σ(2) = 1 / (1 + e⁻²) ≈ 0.881.' },
      { prompt: 'A model predicts p = 0.9. Calculate log loss if the true label is 1, then if it is 0.', answer: 'About 0.105 for label 1 and about 2.303 for label 0.', solution: 'For y = 1, loss = −ln(0.9) ≈ 0.105. For y = 0, loss = −ln(1 − 0.9) = −ln(0.1) ≈ 2.303. The wrong-but-confident case costs about 22 times more.' },
      { prompt: 'A feature has weight 0.7. How does a one-unit increase change the odds? Does it add a fixed amount to the probability?', answer: 'It multiplies the odds by about 2.01; it does not add a fixed probability.', solution: 'The score is the log-odds, so adding 0.7 multiplies the odds by e^0.7 ≈ 2.01. Going from odds 1:1 to about 2:1 moves probability from 0.5 to about 0.67, while going from odds 9:1 to about 18:1 only moves it from 0.9 to about 0.95.' },
    ],
    quiz: { question: 'Why does logistic regression use a sigmoid on its linear score?', options: ['To make training slower and more careful', 'To map any real-valued score to a value between 0 and 1', 'To remove the need for labels'], answer: 1, explanation: 'B is correct: a weighted sum can be any real number, and the sigmoid maps it into (0, 1) so it can be read as a probability. A is wrong because the sigmoid is about output range, not speed. C is wrong because logistic regression is supervised and needs labels to compute log loss.' },
    takeaways: ['Logistic regression is a linear score passed through a sigmoid to produce a probability.', 'Log loss punishes confident mistakes far more than it rewards confident correct answers.', 'The probability and the decision threshold are separate choices, and the threshold should reflect error costs.'],
    interview: { question: 'Why is logistic regression called “regression” if it does classification?', answer: 'It regresses the log-odds of the positive class as a linear function of the features, so the model itself predicts a continuous quantity. It only becomes a classifier when you apply a threshold to the resulting probability.' },
    related: ['linear-regression', 'evaluation-metrics', 'gradient-descent'],
    miniProject: { title: 'Build a calibrated screening model', objective: 'Train a logistic regression and pick a threshold from stated costs instead of accepting 0.5.', tasks: ['Load the breast cancer dataset with `sklearn.datasets.load_breast_cancer` and split off a test set.', 'Fit a pipeline of `StandardScaler` and `LogisticRegression` on the training data.', 'On validation data, compute precision and recall at thresholds 0.1, 0.3, 0.5, 0.7, and 0.9.', 'Choose a threshold assuming a missed case costs ten times a false alarm, then report once on the test set.'], extension: 'Plot a calibration curve with `CalibrationDisplay` and describe where the predicted probabilities can and cannot be trusted.' },
  },
  {
    slug: 'decision-trees-and-ensembles', title: 'Decision trees, random forests, and boosting',
    description: 'A tree asks a series of yes/no questions. Combine hundreds of them and you get some of the best models for tabular data.',
    module: 'Supervised learning', difficulty: 'Intermediate', estimatedMinutes: 18, prerequisites: ['supervised-vs-unsupervised', 'train-validation-test'],
    objectives: ['Calculate Gini impurity and the gain of a split by hand.', 'Explain why a single deep tree overfits.', 'Contrast bagging and boosting and choose one for a tabular problem.'],
    analogy: 'A single tree is one doctor following a flowchart: easy to follow, but a flowchart built from a few past patients can be oddly specific. A random forest asks hundreds of doctors who each trained on different patients and take a vote. Boosting works like a team passing a case along, where each specialist focuses on what the previous ones got wrong.',
    intro: 'A decision tree predicts by asking one question at a time, such as “is income above 40,000?”, and following the answer to a leaf. Trees need no feature scaling, handle mixed feature types, and capture interactions automatically. Alone they are unstable and easily overfit. Ensembles fix that by combining many trees, and on tabular data they remain a first choice that deep learning often fails to beat.',
    sections: [
      { title: 'How a split is chosen', kicker: 'GINI IMPURITY', body: 'At each node the algorithm tries candidate questions and keeps the one that makes the resulting groups most pure. Gini impurity measures how mixed a group is: 1 minus the sum of squared class shares. A pure group has Gini 0, and a 50/50 binary group has Gini 0.5. The value of a split is the parent’s impurity minus the size-weighted impurity of its children.', example: 'A node has 6 positive and 4 negative examples: Gini = 1 − 0.6² − 0.4² = 0.48. A split produces a left child with 4 positive and 1 negative (Gini = 1 − 0.8² − 0.2² = 0.32) and a right child with 2 positive and 3 negative (Gini = 1 − 0.4² − 0.6² = 0.48). Weighted impurity = 0.5(0.32) + 0.5(0.48) = 0.40. The gain is 0.48 − 0.40 = 0.08.' },
      { title: 'Why one deep tree overfits', kicker: 'HIGH VARIANCE', body: 'Left unconstrained, a tree keeps splitting until every leaf is pure, memorizing noise along the way. It is also unstable: a small change in the data can change the first split and therefore everything below it. Limit `max_depth` and `min_samples_leaf` to regularize, and use cross-validation to choose them. A shallow tree is easy to explain, which can matter more than a few points of accuracy.', points: ['Trees are invariant to monotonic feature scaling, so standardization changes nothing.', 'Boundaries are axis-aligned, so a diagonal boundary needs many small steps.', 'Trees cannot extrapolate: a regression tree never predicts outside the range of its training targets.'] },
      { title: 'Bagging: many independent trees', kicker: 'RANDOM FORESTS', body: 'A random forest trains each tree on a bootstrap sample (rows drawn with replacement) and considers only a random subset of features at each split. The randomness makes trees disagree, and averaging predictions from models that make different mistakes cancels much of their variance without much added bias. Adding more trees does not cause overfitting; it just stops helping eventually. Forests work well with little tuning, which makes them a strong default.', points: ['Each tree is grown deep; averaging handles the variance.', 'Rows left out of a bootstrap sample give an “out-of-bag” estimate of performance.', 'Trees train independently, so training parallelizes easily.'] },
      { title: 'Boosting: trees that correct each other', kicker: 'GRADIENT BOOSTING', body: 'Boosting builds shallow trees one after another. Each new tree fits the errors (specifically, the negative gradient of the loss) of the ensemble so far, and its contribution is shrunk by a learning rate. Bagging mainly reduces variance; boosting mainly reduces bias. Boosting often reaches the highest accuracy on tabular data, but more trees can overfit, so tune the learning rate and use early stopping on a validation set. XGBoost, LightGBM, and CatBoost are the common implementations.', kind: 'math', example: 'Suppose the true value is 10 and the first tree predicts 7, leaving a residual of 3. With learning rate 0.1, a second tree that predicts that residual exactly moves the ensemble to 7 + 0.1(3) = 7.3. Many small corrections generalize better than one large one.' },
    ],
    formula: '\\text{Gini} = 1-\\sum_{k} p_k^2 \\qquad F_{m}(x) = F_{m-1}(x) + \\eta\\, h_m(x)', formulaExplanation: 'pₖ is the share of class k in a node, so a pure node scores 0. The second expression is the boosting update: the current ensemble Fₘ₋₁ gains a new tree hₘ, shrunk by the learning rate η. A random forest instead averages independently trained trees.',
    code: py`from sklearn.datasets import make_moons
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier

features, labels = make_moons(n_samples=400, noise=0.3, random_state=7)

candidates = {
    "single tree, unlimited": DecisionTreeClassifier(random_state=7),
    "single tree, depth 3": DecisionTreeClassifier(max_depth=3, random_state=7),
    "random forest": RandomForestClassifier(n_estimators=200, random_state=7),
    "gradient boosting": GradientBoostingClassifier(random_state=7),
}

# Five-fold cross-validation scores each model on data it did not fit
for name, model in candidates.items():
    scores = cross_val_score(model, features, labels, cv=5)
    print(f"{name}: {scores.mean():.3f} +/- {scores.std():.3f}")`,
    codeOutput: 'single tree, unlimited: 0.870 +/- 0.023\nsingle tree, depth 3: 0.905 +/- 0.039\nrandom forest: 0.915 +/- 0.022\ngradient boosting: 0.905 +/- 0.034',
    codeExplanation: 'The unlimited tree memorizes its training folds and scores lowest. Limiting depth helps. The forest scores highest here and with lower spread across folds, which shows its stability. The gaps are close to the fold-to-fold variation, so do not conclude that forests always beat boosting: on this small, simple dataset boosting has little left to correct, and it usually needs tuning to show its advantage.',
    practice: [
      { prompt: 'A node holds 8 positive and 2 negative examples. What is its Gini impurity?', answer: '0.32.', solution: 'The shares are 0.8 and 0.2. Gini = 1 − 0.8² − 0.2² = 1 − 0.64 − 0.04 = 0.32.' },
      { prompt: 'A parent with 10 examples has Gini 0.5. A split gives 4 examples with Gini 0 and 6 examples with Gini 0.444. What is the gain?', answer: 'About 0.233.', solution: 'Weighted child impurity = (4/10)(0) + (6/10)(0.444) ≈ 0.267. The gain is 0.5 − 0.267 ≈ 0.233.' },
      { prompt: 'Your training accuracy is 99% and validation accuracy is 78% on a boosted model. Name two changes you would try.', answer: 'Lower the learning rate with early stopping, and use shallower trees or fewer trees.', solution: 'The gap signals overfitting. Reduce the learning rate and let early stopping choose the tree count, limit tree depth, or subsample rows and features per tree. Also check for leakage and duplicates across splits before blaming complexity.' },
    ],
    quiz: { question: 'What is the main difference between bagging and boosting?', options: ['Bagging trains trees independently and averages them; boosting trains them in sequence to correct earlier errors', 'Bagging only works on images; boosting only works on text', 'Bagging uses one tree; boosting uses many'], answer: 0, explanation: 'A is correct. Bagging, as in random forests, mainly reduces variance by averaging independent trees. Boosting mainly reduces bias by fitting each tree to the remaining errors. B is wrong because both are mostly used on tabular data. C is wrong because both use many trees.' },
    takeaways: ['Trees split to reduce impurity, need no scaling, and overfit easily when left unconstrained.', 'Random forests average many decorrelated trees and work well with little tuning.', 'Boosting fits trees in sequence and often leads on tabular data, but needs a validation set to control it.'],
    interview: { question: 'When would you pick gradient boosting over a neural network?', answer: 'For most tabular problems with heterogeneous features and modest data, where boosted trees are usually accurate, quick to train, and tolerant of unscaled inputs. I would reach for neural networks with images, audio, or text, or when I need to learn representations from raw data at large scale.' },
    related: ['overfitting-underfitting', 'feature-engineering-and-pipelines', 'evaluation-metrics'],
    miniProject: { title: 'Tree, forest, or boosting?', objective: 'Compare the three approaches on a real tabular dataset with a fair evaluation.', tasks: ['Load `sklearn.datasets.fetch_california_housing` and hold out a test set.', 'Cross-validate a depth-limited tree, a random forest, and `HistGradientBoostingRegressor` using RMSE.', 'Plot permutation importance for your best model.', 'Report the test score once and write three sentences on what you would explain to a stakeholder.'], extension: 'Add early stopping to the boosted model and chart validation loss against the number of trees.' },
  },
  {
    slug: 'feature-engineering-and-pipelines', title: 'Feature engineering and leak-proof pipelines',
    description: 'Real data has gaps, categories, and awkward scales. Pipelines make your preparation repeatable and keep test data out of it.',
    module: 'Supervised learning', difficulty: 'Intermediate', estimatedMinutes: 15, prerequisites: ['train-validation-test', 'linear-regression'],
    objectives: ['Choose encodings for numeric, categorical, and date features.', 'Handle missing values without leaking test information.', 'Package preparation and model into one object that fits, predicts, and deploys together.'],
    analogy: 'Think of a restaurant kitchen. Ingredients arrive in different states: some muddy, some frozen, some missing. A good kitchen has a written prep routine, applied identically every night. If a chef tastes tomorrow’s delivery before writing tonight’s recipe, the recipe is not a fair test. A pipeline is the written routine, and the rule against tasting ahead is what prevents leakage.',
    intro: 'Models see numbers, not spreadsheets. Feature engineering turns raw columns into inputs that make the pattern easier to learn, and it often changes results more than swapping algorithms. The risk is that preparation steps also learn from data: an imputer learns a median and a scaler learns a mean. If those steps see validation or test rows, your evaluation is contaminated. Pipelines solve this by treating preparation as part of the model.',
    sections: [
      { title: 'Numbers: scale and shape', kicker: 'NUMERIC FEATURES', body: 'Distance-based models and gradient-trained models are sensitive to scale, so standardize them: subtract the training mean and divide by the training standard deviation. Trees do not care. Skewed values such as income often behave better after a log transform. Ratios and differences can express what a model struggles to construct alone, such as debt divided by income.', example: 'If training ages have mean 40 and standard deviation 10, a 55-year-old becomes (55 − 40) / 10 = 1.5. A test row must use those same training values, never its own mean.' },
      { title: 'Categories: encode with care', kicker: 'CATEGORICAL FEATURES', body: 'One-hot encoding creates a 0/1 column per category. It is safe and simple, but it grows with the number of categories. Do not assign 1, 2, 3 to unordered categories, because that invents an ordering a linear model will take literally. Target encoding replaces a category with its average target, which handles many categories but leaks badly unless it is computed out-of-fold.', points: ['Set `handle_unknown="ignore"` so a new category in production does not crash prediction.', 'Group rare categories together so they do not become noisy columns.', 'Dates hide useful parts: day of week, month, and time since an event.'] },
      { title: 'Missing values are information', kicker: 'IMPUTATION', body: 'Most models cannot accept gaps, so fill them with a median or most-frequent value learned from training data. First ask why a value is missing, because the reason can predict the target: a blank “last purchase date” may mean a brand-new customer. Add a missing-indicator column to keep that signal. Dropping rows is simple, but it shrinks your data and can bias it when missingness is not random.', points: ['Random gaps: simple imputation is usually fine.', 'Gaps related to the target: keep an indicator column.', 'Fit the imputer inside the training fold, never on the full dataset.'] },
      { title: 'Why pipelines prevent leakage', kicker: 'ONE OBJECT, ONE BOUNDARY', body: 'A pipeline chains preparation and model into a single estimator. Calling `fit` learns every step from training rows only, and `predict` applies them unchanged. `cross_val_score` then refits the entire chain inside each fold, which is exactly what manual preprocessing tends to get wrong. A `ColumnTransformer` routes different columns to different steps. Save the fitted pipeline, and your deployed model cannot drift out of sync with its preprocessing.', kind: 'math', example: 'A common mistake: scale all rows, then cross-validate. Each fold’s validation rows have already influenced the mean and standard deviation. The effect on scaling is often small, but the same mistake with feature selection on wide data can turn pure noise into impressive-looking scores.' },
    ],
    formula: 'x_{\\text{scaled}} = \\frac{x - \\mu_{\\text{train}}}{\\sigma_{\\text{train}}}', formulaExplanation: 'The mean μ and standard deviation σ come only from training rows and are reused unchanged for validation, test, and production data. Using anything else lets future information shape the model.',
    code: py`import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# A small synthetic table with missing values in both kinds of column
rng = np.random.default_rng(7)
n = 200
tenure = rng.integers(1, 60, n).astype(float)
plan = rng.choice(["basic", "plus", "pro"], n).astype(object)
churned = (tenure + rng.normal(0, 8, n) < 18).astype(int)
tenure[::20] = np.nan
plan[::25] = np.nan
table = pd.DataFrame({"tenure_months": tenure, "plan": plan})

numeric = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale", StandardScaler()),
])
categorical = Pipeline([
    ("impute", SimpleImputer(strategy="most_frequent")),
    ("encode", OneHotEncoder(handle_unknown="ignore")),
])
prepare = ColumnTransformer([
    ("numeric", numeric, ["tenure_months"]),
    ("categorical", categorical, ["plan"]),
])
model = Pipeline([("prepare", prepare), ("classify", LogisticRegression())])

# Every fold refits the imputers, scaler, and encoder on its own training rows
scores = cross_val_score(model, table, churned, cv=5)
print(f"cross-validated accuracy: {scores.mean():.2f}")

model.fit(table, churned)
print("columns after preparation:", model.named_steps["prepare"].get_feature_names_out().tolist())
new_customer = pd.DataFrame({"tenure_months": [3.0], "plan": ["enterprise"]})
print(f"unseen plan, P(churn)={model.predict_proba(new_customer)[0][1]:.2f}")`,
    codeOutput: "cross-validated accuracy: 0.89\ncolumns after preparation: ['numeric__tenure_months', 'categorical__plan_basic', 'categorical__plan_plus', 'categorical__plan_pro']\nunseen plan, P(churn)=0.93",
    codeExplanation: 'Each column type gets its own preparation path, and all of it lives inside `model`. Passing the whole pipeline to `cross_val_score` means no fold ever sees statistics from its validation rows. The final lines show the production benefit: the plan “enterprise” never appeared in training, and `handle_unknown="ignore"` encodes it as all zeros instead of raising an error. Save this single `model` object and you deploy preprocessing and weights together.',
    practice: [
      { prompt: 'Training ages have mean 40 and standard deviation 10. A test row has age 25. What is its scaled value?', answer: '−1.5.', solution: '(25 − 40) / 10 = −1.5. Use the training mean and standard deviation, even if the test set’s own statistics differ.' },
      { prompt: 'A “color” column has values red, green, and blue. Why is encoding them as 1, 2, 3 risky for linear regression?', answer: 'It invents an order and equal spacing that do not exist.', solution: 'A linear model gives this column one weight, so it must treat blue as exactly three times red and green as exactly between them. One-hot encoding gives each color its own weight. Tree models tolerate integer codes better, because they can split at any point, but the codes still carry no real meaning.' },
      { prompt: 'You select the 20 best features using all rows, then cross-validate. Scores look great. What went wrong, and how do you fix it?', answer: 'Feature selection saw the validation rows. Put it inside the pipeline.', solution: 'Selecting by correlation with the target over every row uses validation labels. With many columns, some noise columns will correlate by chance, and scores become inflated. Add `SelectKBest` as a pipeline step so selection is redone within each training fold.' },
    ],
    quiz: { question: 'What is the main reason to put a scaler inside a pipeline before cross-validating?', options: ['It makes the model train faster', 'The scaler is refit on each fold’s training rows, so validation rows do not influence it', 'Pipelines remove the need for a test set'], answer: 1, explanation: 'B is correct: the pipeline keeps learned preprocessing inside the training boundary of each fold. A is not the purpose. C is wrong because you still need an untouched test set for a final estimate after model selection.' },
    takeaways: ['Good features often improve results more than a fancier algorithm.', 'Imputers, scalers, encoders, and selectors learn from data, so they belong inside the training boundary.', 'A pipeline makes the same preparation run in training, cross-validation, and production.'],
    interview: { question: 'What is target leakage and how have you seen it happen?', answer: 'It occurs when a feature contains information that would not be available at prediction time, usually because it is recorded after the outcome. A “treatment given” column in a disease model is the classic case. It produces excellent offline scores and fails in production. I look for suspiciously strong features and check when each one is recorded.' },
    related: ['train-validation-test', 'decision-trees-and-ensembles', 'serving-models'],
    miniProject: { title: 'Rebuild a messy notebook as one pipeline', objective: 'Turn ad-hoc preprocessing on a public dataset into a single leak-proof, deployable object.', tasks: ['Load the Titanic data with `fetch_openml("titanic", version=1)`, dropping columns that leak the outcome such as `boat` and `body`.', 'Build a `ColumnTransformer` with separate numeric and categorical paths.', 'Compare logistic regression and a random forest using cross-validation over the whole pipeline.', 'Save the best pipeline with `joblib`, reload it, and predict on a hand-written row.'], extension: 'Add a missing-indicator with `SimpleImputer(add_indicator=True)` and test whether it improves the score.' },
  },
]

export const visionLessons: LessonDraft[] = [
  {
    slug: 'image-data-and-augmentation', title: 'Image data: tensors, normalization, and augmentation',
    description: 'What a picture looks like to a model, and how to create useful training variety without collecting more photos.',
    module: 'Computer vision', difficulty: 'Intermediate', estimatedMinutes: 15, prerequisites: ['convolutional-neural-networks'],
    objectives: ['Read an image tensor’s shape and data type.', 'Normalize a pixel by hand using channel statistics.', 'Choose augmentations that keep the label true.'],
    analogy: 'If you only ever saw a coffee mug from the front in bright light, you might not recognize it from the side at dusk. Children see objects from countless angles, so they learn what stays the same. Augmentation shows a model the same object in varied conditions, which teaches it which changes do not matter.',
    intro: 'To a model, an image is a grid of numbers. Before any architecture matters, you need those numbers in the shape and range the model expects, and you need enough variety that the model learns the object instead of the background. Vision bugs are often data bugs: swapped channels, wrong normalization, or augmentations that quietly change the correct answer.',
    sections: [
      { title: 'An image is a tensor', kicker: 'SHAPE AND RANGE', body: 'A color image has height, width, and three channels. PyTorch uses (channels, height, width), and a batch adds a leading dimension: (batch, channels, height, width). Many image libraries and TensorFlow default to channels last instead, and OpenCV loads colors as BGR rather than RGB. Raw pixels are usually 8-bit integers from 0 to 255, and models train on floats.', example: 'A batch of 8 RGB images at 224 × 224 has shape (8, 3, 224, 224), which is 8 × 3 × 224 × 224 = 1,204,224 values. Doubling the side length to 448 quadruples that count, and with it the memory and compute that convolutions need.' },
      { title: 'Normalize the way training did', kicker: 'CHANNEL STATISTICS', body: 'Pixel values are divided by 255, then each channel has its mean subtracted and is divided by its standard deviation. A pretrained model expects the statistics it was trained with. For ImageNet those are the widely used means [0.485, 0.456, 0.406] and standard deviations [0.229, 0.224, 0.225]. Skipping or changing this step usually does not raise an error; accuracy just quietly drops.', example: 'A red-channel pixel of 128 becomes 128 / 255 ≈ 0.502, then (0.502 − 0.485) / 0.229 ≈ 0.074. A pixel of 255 becomes (1.0 − 0.485) / 0.229 ≈ 2.25.' },
      { title: 'Augment without changing the answer', kicker: 'LABEL-PRESERVING VARIETY', body: 'Augmentation randomly transforms training images so the model sees fresh versions each epoch. It works as regularization by encoding what should not matter. The key question is whether the transformation keeps the label true. Flipping a cat is still a cat, but flipping a “6” can look like a different digit, and flipping a chest X-ray swaps the side the heart appears on, which can be clinically meaningful.', points: ['Geometric: flips, small rotations, random crops.', 'Photometric: brightness, contrast, color jitter.', 'Mixing: Cutout, MixUp, and CutMix, which also change the label or hide regions.', 'For detection and segmentation, transform the boxes or masks too.'] },
      { title: 'Keep evaluation honest', kicker: 'DATA SPLITS FOR IMAGES', body: 'Apply random augmentation only to training data. Validation and test images get only deterministic steps, such as a resize, center crop, and normalization. Split before augmenting, and split by source: photos from one patient, camera, or video must stay on one side, because near-duplicates across splits inflate scores. Also look at your images after preprocessing. Plotting one batch finds channel and normalization bugs in seconds.', kind: 'math', points: ['Train: random augmentations plus normalization.', 'Validation and test: deterministic resize plus the same normalization.', 'Group splits: keep frames from one video or scans from one patient together.'] },
    ],
    formula: 'x_{\\text{norm}} = \\frac{x/255 - \\mu_c}{\\sigma_c}', formulaExplanation: 'x is a raw pixel from 0 to 255, and μ_c and σ_c are the mean and standard deviation of its channel c, computed on the training set or inherited from the pretrained model. The same values are applied to every image, in every split.',
    code: py`import torch

torch.manual_seed(7)

# A fake batch: 8 RGB images of 32x32 pixels with values from 0 to 255
images = torch.randint(0, 256, (8, 3, 32, 32), dtype=torch.uint8)
print("raw:", images.shape, images.dtype)

# Scale to 0-1, then normalize each channel
scaled = images.float() / 255
mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
normalized = (scaled - mean) / std
print("normalized:", normalized.shape, normalized.dtype)

# One pixel value worked through the red channel
pixel = torch.tensor(128 / 255)
print("128 in the red channel becomes", round(((pixel - 0.485) / 0.229).item(), 4))

# Horizontal flip reverses the width dimension and keeps the shape
flipped = torch.flip(normalized, dims=[3])
print("flip keeps shape:", flipped.shape == normalized.shape)
print("first row matches reversed:", torch.equal(flipped[0, 0, 0], normalized[0, 0, 0].flip(0)))`,
    codeOutput: 'raw: torch.Size([8, 3, 32, 32]) torch.uint8\nnormalized: torch.Size([8, 3, 32, 32]) torch.float32\n128 in the red channel becomes 0.0741\nflip keeps shape: True\nfirst row matches reversed: True',
    codeExplanation: 'The `view(1, 3, 1, 1)` reshape lets one mean per channel broadcast across the batch, height, and width dimensions. Converting to float before dividing matters, because integer arithmetic would lose the fractions. The flip works on dimension 3, the width, because the layout is (batch, channels, height, width). In a real project, use `torchvision.transforms.v2` or Albumentations rather than writing these by hand.',
    practice: [
      { prompt: 'What is the shape of a batch of 16 grayscale images of 28 × 28 in PyTorch, and how many values does it contain?', answer: 'Shape (16, 1, 28, 28), containing 12,544 values.', solution: 'Grayscale has one channel. The total is 16 × 1 × 28 × 28 = 12,544 values. The channel dimension stays even at size 1, because convolution layers expect it.' },
      { prompt: 'Normalize a pixel value of 51 using mean 0.5 and standard deviation 0.25.', answer: '−1.2.', solution: '51 / 255 = 0.2. Then (0.2 − 0.5) / 0.25 = −1.2.' },
      { prompt: 'You are classifying handwritten digits. Which of these are safe: small rotation, horizontal flip, slight blur?', answer: 'Small rotation and slight blur are safe; a horizontal flip is not.', solution: 'A slight rotation or blur leaves a digit recognizable as the same digit. A horizontal flip can turn a digit into a shape that is not a valid digit, or make it resemble a different one, so it does not preserve the label.' },
    ],
    quiz: { question: 'Which pairing of data handling is correct?', options: ['Random augmentation on train, deterministic preprocessing on validation and test', 'Random augmentation on all splits for fairness', 'Normalization on train only'], answer: 0, explanation: 'A is correct: random variety regularizes training, while evaluation needs stable, repeatable inputs. B makes the metric noisy and no longer reflects the real inputs. C is wrong because the model expects the same normalization at every stage.' },
    takeaways: ['PyTorch images use (batch, channels, height, width), and channel order bugs fail silently.', 'Normalize with the statistics the model was trained on, in every split.', 'An augmentation is only valid if it keeps the label true.'],
    interview: { question: 'Your model scores 98% on validation and 70% in production. What do you check in the image pipeline?', answer: 'I would check for a train-serving mismatch first: resizing method, normalization values, and RGB versus BGR. Then I would check for leakage from near-duplicates across splits and whether production images differ in camera, lighting, or subject. Plotting the actual tensors reaching the model is usually the quickest way to find the cause.' },
    related: ['convolutional-neural-networks', 'transfer-learning', 'monitoring-and-drift'],
    miniProject: { title: 'Measure what augmentation buys you', objective: 'Quantify the effect of augmentation on a small dataset.', tasks: ['Take a subset of 1,000 CIFAR-10 images using `torchvision.datasets.CIFAR10`.', 'Train a small CNN with normalization only and record validation accuracy per epoch.', 'Retrain with random crops and horizontal flips, keeping the same seed and validation set.', 'Compare the curves and the train/validation gap for both runs.'], extension: 'Add CutMix, and explain why its training accuracy looks worse even when validation accuracy improves.' },
  },
  {
    slug: 'transfer-learning', title: 'Transfer learning: standing on a pretrained model',
    description: 'Reuse features learned on millions of images and get good results with hundreds of your own.',
    module: 'Computer vision', difficulty: 'Intermediate', estimatedMinutes: 15, prerequisites: ['image-data-and-augmentation', 'optimizers'],
    objectives: ['Explain why features learned on one task transfer to another.', 'Freeze a backbone, replace the head, and count trainable parameters.', 'Run a two-stage fine-tuning schedule and pick learning rates.'],
    analogy: 'Someone who already plays piano can learn the organ far faster than a beginner, because they keep the reading and finger skills and only learn the pedals and stops. A pretrained network already knows how to see edges and textures. You keep those skills and teach it only what is specific to your task.',
    intro: 'Training a large vision model from scratch takes huge datasets. Transfer learning starts from a model trained on another task, usually ImageNet, and adapts it. Early layers learn general features such as edges and textures, while later layers become task-specific. By reusing the general part and retraining the end, you can get strong results with far less data, compute, and time. This is the default starting point for most applied vision work.',
    sections: [
      { title: 'Backbone and head', kicker: 'TWO PARTS OF A MODEL', body: 'A classifier divides into a backbone, which turns an image into a feature vector, and a head, which turns those features into class scores. For transfer learning, you discard the original head and attach one sized for your classes. The head has very few parameters compared with the backbone, so it can be trained from a small dataset without much risk of overfitting.', example: 'ResNet-50 outputs a 2,048-dimensional feature vector and has about 25.6 million parameters in total. A new linear head for 3 classes has 2048 × 3 + 3 = 6,147 parameters, which is roughly 0.02% of the whole model.' },
      { title: 'Stage 1: train only the head', kicker: 'FREEZE THE BACKBONE', body: 'Set `requires_grad = False` on backbone parameters so training leaves them untouched, and train the head for a few epochs. Do this first because the new head starts random and produces large, meaningless gradients, which would damage good pretrained weights. Batch normalization needs special care: its running statistics update in training mode even when its parameters are frozen, so keep frozen BatchNorm layers in `eval()` mode.', points: ['Pass only trainable parameters to the optimizer.', 'A higher rate, such as 1e-3, is fine for a fresh head.', 'If this stage alone reaches your target, you can stop here.'] },
      { title: 'Stage 2: fine-tune with care', kicker: 'UNFREEZE GRADUALLY', body: 'Next, unfreeze some or all of the backbone and continue with a much lower learning rate, such as 1e-5 for the backbone and 1e-4 for the head. Unfreeze the last blocks first, since they are the most task-specific. Discriminative learning rates, where earlier layers move less, let the model adapt without losing what it already learned. Watch validation loss closely; a small dataset can now overfit.', kind: 'math', points: ['Too high a rate here can destroy pretrained features quickly.', 'Rebuild or update the optimizer after changing what is trainable.', 'Use the normalization the pretrained weights expect.'] },
      { title: 'How much to retrain', kicker: 'A DECISION GUIDE', body: 'The right approach depends on how much data you have and how similar it is to the source task. With little data and a similar domain, train the head only. With more data, fine-tune more layers. With a very different domain, such as medical scans or satellite images, the high-level features transfer less, so fine-tune deeper or look for a pretrained model from a closer domain. Check the license of pretrained weights before shipping them commercially.', example: 'With 300 photos of 3 plant diseases: freeze the backbone and train the head, then evaluate. With 30,000 satellite images: fine-tune most of the network, because the domain differs and you have the data to support it.' },
    ],
    formula: '\\theta_{\\text{backbone}} \\leftarrow \\theta_{\\text{backbone}} - \\eta_{b}\\nabla L \\qquad \\theta_{\\text{head}} \\leftarrow \\theta_{\\text{head}} - \\eta_{h}\\nabla L \\qquad \\eta_{b} \\ll \\eta_{h}', formulaExplanation: 'During fine-tuning, both parts learn from the same loss, but the backbone uses a much smaller learning rate. In stage one, η_b is effectively zero because the backbone is frozen.',
    code: py`import torch
from torch import nn

torch.manual_seed(7)

# Stand-in for a pretrained backbone, so this runs without downloading weights
backbone = nn.Sequential(
    nn.Conv2d(3, 16, kernel_size=3, padding=1),
    nn.ReLU(),
    nn.AdaptiveAvgPool2d(1),
    nn.Flatten(),
)
head = nn.Linear(16, 3)  # new classifier for our 3 classes

def count(parameters):
    return sum(p.numel() for p in parameters if p.requires_grad)

# Stage 1: freeze the backbone and train only the head
for parameter in backbone.parameters():
    parameter.requires_grad = False
print("trainable while frozen:", count(backbone.parameters()) + count(head.parameters()))

optimizer = torch.optim.Adam(head.parameters(), lr=1e-3)
images = torch.randn(4, 3, 32, 32)
targets = torch.tensor([0, 1, 2, 1])
before = backbone[0].weight.clone()

logits = head(backbone(images))
loss = nn.functional.cross_entropy(logits, targets)
optimizer.zero_grad()
loss.backward()
optimizer.step()
print("logits shape:", logits.shape)
print("backbone unchanged:", torch.equal(before, backbone[0].weight))

# Stage 2: unfreeze and fine-tune, using a smaller rate for pretrained layers
for parameter in backbone.parameters():
    parameter.requires_grad = True
optimizer = torch.optim.Adam([
    {"params": backbone.parameters(), "lr": 1e-5},
    {"params": head.parameters(), "lr": 1e-4},
])
print("trainable after unfreezing:", count(backbone.parameters()) + count(head.parameters()))`,
    codeOutput: 'trainable while frozen: 51\nlogits shape: torch.Size([4, 3])\nbackbone unchanged: True\ntrainable after unfreezing: 499',
    codeExplanation: 'The head has 16 × 3 + 3 = 51 parameters, and the convolution has 3 × 16 × 9 + 16 = 448. So 51 are trainable while frozen and 499 after unfreezing. The `torch.equal` check proves the frozen backbone did not move during a real training step. To use a real backbone, load `torchvision.models.resnet50(weights="DEFAULT")` and replace `model.fc`; the freezing logic is the same.',
    practice: [
      { prompt: 'A backbone outputs 512 features and you need 10 classes. How many parameters does a linear head have?', answer: '5,130.', solution: 'Weights: 512 × 10 = 5,120. Biases: 10. The total is 5,130.' },
      { prompt: 'You unfreeze the whole model and keep the head’s learning rate of 1e-3 for everything. Validation accuracy collapses. Why, and what do you change?', answer: 'The rate is too high for pretrained weights. Use a much lower backbone rate.', solution: 'Good weights sit in a useful region, and large steps knock them out of it. Lower the backbone rate to around 1e-5, use a separate parameter group for the head, and consider unfreezing only the last block first.' },
      { prompt: 'You have 200 labeled X-rays and an ImageNet model. Which plan do you start with, and why?', answer: 'Freeze the backbone, train the head, and evaluate before fine-tuning anything.', solution: 'With so few examples, training the full model would overfit quickly. Start with the head and strong evaluation by patient. If results fall short, unfreeze only the last block with a low rate, and search for weights pretrained on medical images, since the domain differs a lot from ImageNet.' },
    ],
    quiz: { question: 'Why is the head usually trained before fine-tuning the backbone?', options: ['The head starts random, and its large early gradients could damage the pretrained weights', 'Backbones cannot be trained at all', 'It makes the images higher resolution'], answer: 0, explanation: 'A is correct: stabilizing the head first keeps early gradients from disrupting useful pretrained features. B is false, since backbones are often fine-tuned. C is unrelated to training order.' },
    takeaways: ['Early layers learn general visual features that transfer well across tasks.', 'Train the new head first, then fine-tune with a much smaller learning rate.', 'How much to unfreeze depends on your data size and how close your domain is to the source.'],
    interview: { question: 'When would transfer learning fail or hurt?', answer: 'When the source and target domains differ too much, the features may not help, which is called negative transfer. It is also weak when the input modality differs, such as multispectral channels the model has never seen. I would compare against a smaller model trained from scratch and evaluate with properly grouped splits.' },
    related: ['image-data-and-augmentation', 'optimizers', 'object-detection-and-segmentation'],
    miniProject: { title: 'Classify flowers with very little data', objective: 'Compare training from scratch against transfer learning on a small dataset.', tasks: ['Use `torchvision.datasets.Flowers102` and keep its small official training split.', 'Train a small CNN from scratch as a baseline.', 'Train a `resnet18` head only, then fine-tune the last block with a lower rate.', 'Compare accuracy, training time, and the number of trainable parameters.'], extension: 'Visualize misclassified images and try Grad-CAM to see what the model looked at.' },
  },
  {
    slug: 'object-detection-and-segmentation', title: 'Object detection and segmentation',
    description: 'Go beyond naming an image: find where things are and outline them, pixel by pixel.',
    module: 'Computer vision', difficulty: 'Intermediate', estimatedMinutes: 17, prerequisites: ['convolutional-neural-networks', 'evaluation-metrics'],
    objectives: ['Calculate IoU by hand and explain how it defines a correct detection.', 'Implement non-maximum suppression.', 'Choose between classification, detection, and segmentation, and read mAP and Dice.'],
    analogy: 'Classification answers “is there a dog in this photo?” Detection draws a rectangle around each dog. Semantic segmentation colors in every dog pixel, and instance segmentation colors each dog in a different shade. Each step costs more labeling effort, so use the simplest one that answers your question.',
    intro: 'Many real tasks need location: a robot picking parts, a car avoiding pedestrians, or a radiologist measuring a tumor. Detection predicts a class and a box for each object, and segmentation predicts a class for every pixel. Both build on the convolutional backbones you already know, adding specialized heads, losses, and metrics. Their labels are also far more expensive to collect, so choosing the right task saves a lot of money.',
    sections: [
      { title: 'Choose the right task', kicker: 'THREE LEVELS OF DETAIL', body: 'Classification outputs one or more labels per image. Detection outputs a box, class, and confidence for each object. Semantic segmentation outputs a class per pixel and does not separate two touching objects of the same class. Instance segmentation separates them, and panoptic segmentation combines both views. Labeling costs rise quickly, from a few seconds per image to minutes.', points: ['Counting separate items: detection or instance segmentation.', 'Measuring area or shape: segmentation.', 'Knowing only whether something appears: classification is enough.'] },
      { title: 'IoU decides what counts as correct', kicker: 'INTERSECTION OVER UNION', body: 'To grade a predicted box, compare it with the true box using Intersection over Union: the overlapping area divided by the combined area. An IoU of 1 is a perfect match and 0 means no overlap. A detection counts as a true positive when its class is right and its IoU clears a threshold, commonly 0.5.', example: 'Box A is (0, 0, 4, 4) and box B is (2, 2, 6, 6). The overlap is 2 × 2 = 4. Each box has area 16, so the union is 16 + 16 − 4 = 28, and IoU = 4 / 28 ≈ 0.143. Shifting B to (1, 1, 5, 5) gives an overlap of 9 and a union of 23, for an IoU of about 0.391.' },
      { title: 'From many guesses to one per object', kicker: 'DETECTOR DESIGNS AND NMS', body: 'Two-stage detectors such as Faster R-CNN first propose regions, then classify them, which tends to be accurate. One-stage detectors such as YOLO predict directly over a grid, which is fast. Both typically produce many overlapping boxes per object. Non-maximum suppression (NMS) cleans these up: keep the highest-scoring box, remove boxes overlapping it above a threshold, and repeat. Transformer-based detectors such as DETR predict a set of objects directly and do not need NMS.', example: 'Take three boxes with scores 0.90, 0.75, and 0.80, where the first two overlap heavily. NMS keeps the 0.90 box, removes the 0.75 box as a duplicate, and keeps the distant 0.80 box.' },
      { title: 'Metrics and segmentation', kicker: 'MAP AND DICE', body: 'Detection is graded with mean average precision (mAP): the area under the precision-recall curve per class, then averaged across classes. COCO-style mAP also averages over IoU thresholds from 0.5 to 0.95, rewarding precise localization. Segmentation commonly uses Dice or pixel IoU rather than pixel accuracy, because a small object can be missed entirely while pixel accuracy stays high. U-Net’s encoder-decoder design with skip connections, which recover fine detail, remains a standard starting point.', kind: 'math', example: 'If an object covers 4 pixels, a model predicts 3 pixels, and 2 of them are correct, then Dice = 2 × 2 / (4 + 3) ≈ 0.571. On a 100-pixel image, a model that predicts all background gets 96% pixel accuracy on the same object, but a Dice of 0.' },
    ],
    formula: '\\text{IoU}=\\frac{|A\\cap B|}{|A\\cup B|} \\qquad \\text{Dice}=\\frac{2|A\\cap B|}{|A|+|B|}', formulaExplanation: 'A and B are the predicted and true regions. Both scores run from 0 to 1. Dice gives more weight to the overlap, so it reads higher than IoU on the same prediction, unless the match is perfect or there is no overlap at all.',
    code: py`def iou(a, b):
    # Boxes are (x1, y1, x2, y2)
    width = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    height = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    overlap = width * height
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return overlap / (area_a + area_b - overlap)

def non_max_suppression(boxes, scores, threshold=0.5):
    order = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    keep = []
    while order:
        best = order.pop(0)
        keep.append(best)
        order = [i for i in order if iou(boxes[best], boxes[i]) < threshold]
    return keep

print("IoU:", round(iou((0, 0, 4, 4), (2, 2, 6, 6)), 3))
print("IoU:", round(iou((0, 0, 4, 4), (1, 1, 5, 5)), 3))

boxes = [(10, 10, 50, 50), (12, 12, 52, 52), (100, 100, 140, 140)]
scores = [0.90, 0.75, 0.80]
print("kept box indexes:", non_max_suppression(boxes, scores))

def dice(true_pixels, predicted_pixels):
    overlap = len(true_pixels & predicted_pixels)
    return 2 * overlap / (len(true_pixels) + len(predicted_pixels))

truth = {(0, 0), (0, 1), (1, 0), (1, 1)}
prediction = {(0, 1), (1, 1), (1, 2)}
print("Dice:", round(dice(truth, prediction), 3))`,
    codeOutput: 'IoU: 0.143\nIoU: 0.391\nkept box indexes: [0, 2]\nDice: 0.571',
    codeExplanation: 'The `max(0, …)` guards handle boxes that do not touch, where the overlap would otherwise come out as a negative width. In the NMS loop, box 1 is dropped because it overlaps box 0 heavily, while box 2 survives because it is elsewhere in the image. Note that the returned order follows the scores: 0.90, then 0.80. In real work, use `torchvision.ops.nms`, and run NMS per class so a person and a bicycle in the same spot do not cancel each other.',
    practice: [
      { prompt: 'Calculate IoU for boxes (0, 0, 2, 2) and (1, 0, 3, 2).', answer: '1/3, or about 0.333.', solution: 'The overlap runs x from 1 to 2 and y from 0 to 2, so its area is 1 × 2 = 2. Each box has area 4, so the union is 4 + 4 − 2 = 6. IoU = 2 / 6 ≈ 0.333.' },
      { prompt: 'You lower the NMS threshold from 0.7 to 0.3. What happens in a crowded scene?', answer: 'More boxes are removed, and real neighboring objects may be lost.', solution: 'A lower threshold treats smaller overlaps as duplicates. In a crowd, two different people can overlap by 0.4, so a valid detection is suppressed, which lowers recall. Soft-NMS, which reduces scores instead of deleting boxes, can help here.' },
      { prompt: 'A warehouse wants to count boxes on shelves, and they often touch. Which task do you choose?', answer: 'Detection, or instance segmentation when the objects overlap heavily.', solution: 'Semantic segmentation merges touching objects of the same class, so it cannot count them. Detection gives a separate result per object at lower labeling cost, so start there. Move to instance segmentation if heavy overlap defeats boxes.' },
    ],
    quiz: { question: 'Why can pixel accuracy be misleading for segmentation?', options: ['It only works on grayscale images', 'A rare small object can be missed while accuracy stays high because background dominates', 'It is impossible to compute'], answer: 1, explanation: 'B is correct: when background fills most of the image, predicting all background scores well while missing the object entirely. Dice and IoU focus on overlap with the object. A and C are false.' },
    takeaways: ['Choose the simplest task that answers the question, because labels get expensive quickly.', 'IoU defines whether a detection is correct, and NMS removes duplicate boxes.', 'Use mAP for detection and Dice or IoU for segmentation, not pixel accuracy.'],
    interview: { question: 'What is the difference between one-stage and two-stage detectors?', answer: 'Two-stage detectors first propose candidate regions, then classify and refine them, and they often lead on accuracy. One-stage detectors predict classes and boxes in a single pass, which is usually faster. The gap has narrowed a lot, so I would choose using measured accuracy and latency on the target hardware.' },
    related: ['convolutional-neural-networks', 'transfer-learning', 'evaluation-metrics'],
    miniProject: { title: 'Fine-tune a detector', objective: 'Adapt a pretrained detector to a small custom dataset and measure it properly.', tasks: ['Label about 100 images, or use the Penn-Fudan pedestrian dataset.', 'Load `torchvision.models.detection.fasterrcnn_resnet50_fpn` with pretrained weights and replace its box predictor.', 'Train with horizontal flips, transforming the boxes along with the images.', 'Report mAP at IoU 0.5 and at 0.5:0.95 using `torchmetrics`, and inspect the worst predictions.'], extension: 'Vary the score threshold and NMS threshold, then plot how precision and recall respond.' },
  },
]

export const languageLessons: LessonDraft[] = [
  {
    slug: 'tokenization-and-embeddings', title: 'Tokens and embeddings: turning text into numbers',
    description: 'Language models never see words. They see token ids and learned vectors where meaning becomes geometry.',
    module: 'Language & LLMs', difficulty: 'Intermediate', estimatedMinutes: 15, prerequisites: ['neural-networks'],
    objectives: ['Tokenize text and handle unknown words and padding.', 'Explain why subword tokenizers replaced whole-word vocabularies.', 'Calculate cosine similarity and explain what embeddings do and do not capture.'],
    analogy: 'Imagine a map where cities with similar climates sit close together. The coordinates mean nothing on their own, but distance is meaningful. Embeddings are a map for tokens with hundreds of dimensions, built so that tokens used in similar contexts end up nearby.',
    intro: 'A neural network needs numbers, so text must become numbers first. Tokenization splits text into pieces and assigns each an integer id. An embedding layer then maps each id to a vector of learned values, and those vectors are what the model actually processes. These early choices decide what a model can represent, what it costs, and some surprising failures, such as why models can miscount letters in a word.',
    sections: [
      { title: 'Tokenization splits text into ids', kicker: 'FROM STRINGS TO INTEGERS', body: 'A simple tokenizer splits on whitespace and looks words up in a vocabulary. Reserved ids handle special cases: <pad> fills short sequences so batches line up, and <unk> stands in for anything not in the vocabulary. An attention mask tells the model which positions are real and which are padding. The vocabulary must be built from training data and then frozen.', example: 'With the vocabulary {<pad>: 0, <unk>: 1, the: 2, cat: 3, sat: 4, dog: 5, a: 6, ran: 7}, the text “the cat ran fast” encodes to [2, 3, 7, 1, 0] at length 5. “fast” is unknown, so it becomes 1, and the final 0 is padding.' },
      { title: 'Subword tokenizers', kicker: 'WHY MODERN MODELS SPLIT WORDS', body: 'Whole-word vocabularies grow huge and still fail on new words, typos, and rare names. Byte-Pair Encoding (BPE) instead starts from characters and repeatedly merges the most frequent adjacent pair, so common words stay whole and rare words split into pieces. The model always has some representation for any input, with no unknown tokens. This also explains why token counts differ from word counts, and why models cost and limit by tokens.', points: ['A rough rule for English text: 1 token is about ¾ of a word, or about 4 characters.', 'Models see tokens, not letters, so character-level tasks such as counting letters are harder than they appear.', 'A model and its tokenizer are a pair, so never swap one without the other.'] },
      { title: 'Embeddings: meaning as geometry', kicker: 'LEARNED VECTORS', body: 'An embedding layer is a lookup table with one learned vector per token id. Training moves vectors so that tokens appearing in similar contexts end up close together, an idea known as the distributional hypothesis. A one-hot vector treats every pair of words as equally different; an embedding of a few hundred dimensions can capture degrees of similarity. Classic word embeddings give one vector per word, so “bank” gets the same vector for rivers and money, while transformer outputs depend on context.', example: 'A vocabulary of 50,000 tokens with 768-dimensional embeddings has a table of 50,000 × 768 = 38.4 million parameters.' },
      { title: 'Measuring similarity', kicker: 'COSINE SIMILARITY', body: 'Cosine similarity compares the direction of two vectors, ignoring length: dot product divided by the product of their norms. It runs from −1 to 1, with higher meaning more similar. Sentence and document embeddings use the same idea and power semantic search, clustering, and recommendation. Be careful, though: embeddings absorb patterns from their training text, including social biases, and similarity is not the same as truth. “The drug works” and “the drug does not work” can sit very close together.', kind: 'math', example: 'For cat = [0.9, 0.8, 0.1] and dog = [0.8, 0.9, 0.2], the dot product is 1.46 and the norms are about 1.208 and 1.220, so cosine ≈ 0.990. For ran = [0.1, 0.2, 0.9], cat versus ran gives about 0.303.' },
    ],
    formula: '\\cos(a,b)=\\frac{a\\cdot b}{\\lVert a\\rVert\\,\\lVert b\\rVert}', formulaExplanation: 'a · b sums the element-wise products, and the norms divide out each vector’s length, leaving only the angle between them. 1 means the same direction, 0 means perpendicular, and −1 means opposite.',
    code: py`import numpy as np

# Build a tiny vocabulary with reserved ids for padding and unknown words
texts = ["the cat sat", "the dog sat", "a dog ran"]
vocabulary = {"<pad>": 0, "<unk>": 1}
for text in texts:
    for word in text.split():
        vocabulary.setdefault(word, len(vocabulary))
print("vocabulary size:", len(vocabulary))

def encode(text, length=5):
    ids = [vocabulary.get(word, vocabulary["<unk>"]) for word in text.split()]
    return (ids + [0] * length)[:length]

print("encoded:", encode("the cat ran fast"))

# Hand-made 3-D vectors standing in for learned embeddings
embeddings = {
    "cat": np.array([0.9, 0.8, 0.1]),
    "dog": np.array([0.8, 0.9, 0.2]),
    "ran": np.array([0.1, 0.2, 0.9]),
}

def cosine(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

print("cat vs dog:", round(cosine(embeddings["cat"], embeddings["dog"]), 3))
print("cat vs ran:", round(cosine(embeddings["cat"], embeddings["ran"]), 3))`,
    codeOutput: 'vocabulary size: 8\nencoded: [2, 3, 7, 1, 0]\ncat vs dog: 0.99\ncat vs ran: 0.303',
    codeExplanation: '`setdefault` assigns the next free id only to new words, so ids stay stable. `encode` first pads and then cuts to a fixed length, which is what lets sequences form a rectangular batch. These vectors are written by hand to make the calculation clear. In a real model, `nn.Embedding(vocab_size, dim)` starts them at random and training moves them.',
    practice: [
      { prompt: 'Using the lesson’s vocabulary, encode “a cat flew” at length 4.', answer: '[6, 3, 1, 0].', solution: '“a” is 6, “cat” is 3, and “flew” is not in the vocabulary, so it becomes <unk> = 1. Padding fills the last position with 0.' },
      { prompt: 'Calculate the cosine similarity of [1, 0] and [1, 1].', answer: 'About 0.707.', solution: 'The dot product is 1. The norms are 1 and √2. So cosine = 1 / √2 ≈ 0.707, which corresponds to a 45° angle.' },
      { prompt: 'How many parameters does an embedding table have for 30,000 tokens at 512 dimensions, and how would doubling the vocabulary change it?', answer: '15.36 million, and doubling the vocabulary doubles it.', solution: '30,000 × 512 = 15,360,000. The table is one row per token, so it grows linearly with vocabulary size and with the embedding dimension.' },
    ],
    quiz: { question: 'Why do modern language models use subword tokens instead of whole words?', options: ['Subwords look more scientific', 'They handle rare and unseen words by splitting them into known pieces', 'They remove the need for embeddings'], answer: 1, explanation: 'B is correct: any word can be built from smaller known pieces, which avoids unknown tokens and keeps the vocabulary manageable. A is not a technical reason. C is wrong because every token still maps to an embedding.' },
    takeaways: ['Tokenizers convert text to ids, and a model must be used with its own tokenizer.', 'Embeddings are learned vectors in which similar usage leads to nearby positions.', 'Cosine similarity measures closeness in direction, not truth.'],
    interview: { question: 'How are static word embeddings different from contextual embeddings?', answer: 'Static embeddings such as word2vec assign one vector per word type, so “bank” is the same in every sentence. Contextual embeddings, from models like BERT, compute a vector for each occurrence from its surrounding text, so the two senses of “bank” get different vectors.' },
    related: ['recurrent-neural-networks', 'attention-mechanism', 'how-llms-generate-text'],
    miniProject: { title: 'Build a semantic search over your notes', objective: 'See embeddings work end to end on your own text.', tasks: ['Collect about 50 short notes or paragraphs.', 'Compute embeddings with `sentence-transformers` using the `all-MiniLM-L6-v2` model.', 'For a query, return the top 3 notes by cosine similarity.', 'Compare with exact keyword search on 10 queries and record where each one wins.'], extension: 'Plot the embeddings in 2-D with PCA and see which notes cluster together.' },
  },
  {
    slug: 'how-llms-generate-text', title: 'How LLMs generate text',
    description: 'A language model predicts one token at a time. Sampling, temperature, and context windows explain most of its behavior.',
    module: 'Language & LLMs', difficulty: 'Intermediate', estimatedMinutes: 17, prerequisites: ['transformers', 'tokenization-and-embeddings'],
    objectives: ['Describe the generation loop and context window.', 'Apply temperature to logits by hand, and explain top-k and top-p sampling.', 'Explain why models make things up and how training shapes behavior.'],
    analogy: 'Imagine an extremely well-read autocomplete. It has read an enormous library and, given your sentence so far, it estimates what comes next. It writes one piece, reads everything again including that piece, and continues. It is not looking anything up. It is predicting what plausible text looks like.',
    intro: 'An LLM is a transformer trained to predict the next token. Everything else, including chat, code, and translation, emerges from repeating that one step. This view explains a lot of practical behavior: why settings like temperature change the output, why long conversations can lose earlier context, and why a model can state something false with complete confidence.',
    sections: [
      { title: 'The generation loop', kicker: 'ONE TOKEN AT A TIME', body: 'Tokenize the prompt and pass it through the model, which outputs a logit for every token in the vocabulary. Convert these to a probability distribution, pick one token, append it, and repeat until a stop token or a length limit. Production systems cache attention keys and values from earlier tokens, so each step only computes the new one. The context window limits how many tokens the model can consider at once, covering both the prompt and the response.', points: ['Input and output tokens both count toward the context window.', 'Anything outside the window is not seen, unless it is summarized or retrieved back in.', 'Cost and latency usually scale with token counts.'] },
      { title: 'Temperature and sampling', kicker: 'CONTROLLING RANDOMNESS', body: 'Greedy decoding always takes the top token, which tends to be repetitive. Sampling draws from the distribution instead. Temperature divides the logits first: below 1 sharpens the distribution and above 1 flattens it. Top-k keeps only the k most likely tokens, and top-p (nucleus sampling) keeps the smallest set whose probabilities sum to at least p. Lower settings suit extraction and factual tasks, and higher ones suit brainstorming.', example: 'For logits [2, 1, 0], temperature 1 gives probabilities [0.665, 0.245, 0.090]. Temperature 0.5 doubles the logits to [4, 2, 0], giving [0.867, 0.117, 0.016]. Temperature 2 halves them to [1, 0.5, 0], giving [0.506, 0.307, 0.186]. The order never changes; only the confidence does.' },
      { title: 'How models are trained', kicker: 'PRETRAINING AND ALIGNMENT', body: 'Pretraining fits next-token prediction on large text collections, using cross-entropy loss. The result continues text but does not reliably follow instructions. A second phase shapes behavior: supervised fine-tuning on instruction examples, then preference-based methods in which humans or models rank responses, such as RLHF and Constitutional AI. Fine-tuning a pretrained model for a narrow domain is often more practical than training from scratch, and much of a model’s value comes from this second stage.', points: ['A knowledge cutoff exists because training data stops at some date.', 'System prompts are ordinary input the model is trained to prioritize, not hard rules.', 'Prompting well means giving clear context, examples, and an output format.'] },
      { title: 'Why models make things up', kicker: 'LIMITS TO DESIGN AROUND', body: 'A model is trained to produce plausible continuations, and it has no built-in check against reality. So it can produce a confident, fluent, and false statement, including invented citations. This is called hallucination, and well-written text is no evidence against it. Reduce the risk by providing sources through retrieval, asking the model to cite them, validating structured output, and evaluating on a test set for your task. Treat text from users or retrieved documents as untrusted, because prompt injection can try to override your instructions.', kind: 'math', points: ['Use retrieval for facts and tools for arithmetic or current data.', 'Build an evaluation set and rerun it whenever the prompt or model changes.', 'Keep a person in the loop for high-stakes decisions.'] },
    ],
    formula: 'P(t_i)=\\frac{\\exp(z_i/T)}{\\sum_j \\exp(z_j/T)}', formulaExplanation: 'zᵢ is the logit for token i, and T is the temperature. T = 1 is the plain softmax. As T approaches 0, the probability concentrates on the top token, which is greedy decoding. As T grows, the distribution approaches uniform.',
    code: py`import numpy as np

logits = np.array([2.0, 1.0, 0.0])
words = ["blue", "cloudy", "green"]

def softmax(values):
    exponentials = np.exp(values - values.max())
    return exponentials / exponentials.sum()

# Temperature divides the logits before softmax
for temperature in (0.5, 1.0, 2.0):
    probabilities = softmax(logits / temperature)
    print(temperature, probabilities.round(3).tolist())

def sample_next(logits, temperature, top_k, rng):
    scaled = logits / temperature
    keep = np.argsort(scaled)[-top_k:]       # the k highest-scoring tokens
    probabilities = softmax(scaled[keep])
    return keep[rng.choice(len(keep), p=probabilities)]

rng = np.random.default_rng(7)
draws = [words[sample_next(logits, 1.0, 2, rng)] for _ in range(1000)]
print("top-2 draws:", {word: draws.count(word) for word in words})`,
    codeOutput: '0.5 [0.867, 0.117, 0.016]\n1.0 [0.665, 0.245, 0.09]\n2.0 [0.506, 0.307, 0.186]\ntop-2 draws: {\'blue\': 721, \'cloudy\': 279, \'green\': 0}',
    codeExplanation: 'Subtracting the maximum before `np.exp` is a standard trick that avoids overflow. The output confirms the hand calculation. Top-k with k = 2 makes “green” impossible, and “blue” appears about 73% of the time, since 0.665 / (0.665 + 0.245) ≈ 0.731. This is how a sampler works in a real model, except that the logits come from a transformer and cover tens of thousands of tokens.',
    practice: [
      { prompt: 'Logits are [1, 0] and temperature is 1. What is the probability of the first token? What happens at temperature 0.5?', answer: 'About 0.731 at temperature 1, and about 0.881 at temperature 0.5.', solution: 'At T = 1: e¹ / (e¹ + e⁰) = 2.718 / 3.718 ≈ 0.731. At T = 0.5, the logits become [2, 0], so e² / (e² + 1) = 7.389 / 8.389 ≈ 0.881.' },
      { prompt: 'Probabilities are [0.5, 0.3, 0.15, 0.05]. Which tokens does top-p with p = 0.75 keep?', answer: 'The first two tokens.', solution: 'Accumulate in order: 0.5, then 0.8. The total reaches at least 0.75 after two tokens, so the top two are kept and their probabilities are renormalized to 0.625 and 0.375.' },
      { prompt: 'A model has a 200,000-token context window. A prompt uses 195,000 tokens and you request up to 10,000 in the output. What happens?', answer: 'The request does not fit, because the input and output share the window.', solution: '195,000 + 10,000 = 205,000, which exceeds 200,000. Depending on the API, it returns an error or stops early. Shorten the input, for example by retrieving only relevant passages or summarizing history, or reduce the output limit.' },
    ],
    quiz: { question: 'What does lowering the temperature do?', options: ['Changes which token has the highest logit', 'Concentrates probability on the most likely tokens, making output more predictable', 'Makes the model look up facts'], answer: 1, explanation: 'B is correct: dividing logits by a small T widens the gaps between them, so softmax concentrates on the top tokens. A is wrong because scaling keeps the order. C is wrong because temperature only changes sampling and has no effect on the model’s knowledge.' },
    takeaways: ['LLMs generate by repeatedly predicting a distribution over the next token and sampling from it.', 'Temperature, top-k, and top-p control randomness, not knowledge.', 'Fluent text is not evidence of truth, so ground important answers in sources and evaluate them.'],
    interview: { question: 'How would you reduce hallucinations in an LLM application?', answer: 'Combine retrieval so the model answers from supplied sources, instructions to cite those sources and to say when it does not know, lower temperature for factual tasks, and verification steps such as schema checks and citation validation. Then measure with an evaluation set of real questions, because without one you cannot tell if a change helped.' },
    related: ['transformers', 'tokenization-and-embeddings', 'retrieval-augmented-generation'],
    miniProject: { title: 'Build a character-level text generator', objective: 'Implement the generation loop yourself, with no libraries hiding it.', tasks: ['Train a small character-level model in PyTorch on a text file of your choice.', 'Write a `generate` function with greedy decoding, temperature, and top-k.', 'Generate the same prompt at temperatures 0.2, 0.8, and 1.5, and compare the results.', 'Measure how the output changes as you limit the context window.'], extension: 'Add top-p sampling, and test whether caching earlier computation makes your loop faster.' },
  },
  {
    slug: 'retrieval-augmented-generation', title: 'Retrieval-augmented generation (RAG)',
    description: 'Give a language model the right documents at answer time. Most RAG quality is decided before the model is ever called.',
    module: 'Language & LLMs', difficulty: 'Advanced', estimatedMinutes: 19, prerequisites: ['how-llms-generate-text', 'tokenization-and-embeddings'],
    objectives: ['Trace the RAG pipeline from chunking to a cited answer.', 'Calculate reciprocal rank fusion and explain hybrid search.', 'Evaluate retrieval and generation separately.'],
    analogy: 'A closed-book exam tests what you memorized, and an open-book exam lets you look things up. RAG turns a language model’s exam into an open-book one. It still needs to find the right page and read it correctly, and most failures come from finding the wrong page.',
    intro: 'A model does not know your private documents or recent events. Retrieval-augmented generation fetches relevant text at question time and places it in the prompt, so the model answers from evidence. It is often a better first step than fine-tuning when the issue is missing knowledge: documents can be updated without retraining, and answers can cite sources. Quality depends mostly on retrieval, since a model cannot use a passage that was never retrieved.',
    sections: [
      { title: 'Indexing: chunking is a design choice', kicker: 'BEFORE ANY QUESTION ARRIVES', body: 'Split documents into chunks, embed each one, and store the vectors with metadata such as source and date. Chunk size is a real trade-off: small chunks match precisely but lose context, and large chunks keep context but dilute the match and use more of the context window. Split on structure such as headings and paragraphs, and overlap chunks slightly so an idea is not cut in half. Filter by metadata when you can, so a query about 2026 policy does not retrieve the 2019 version.', points: ['Common starting point: a few hundred tokens with roughly 10–20% overlap.', 'Tables and code usually need their own handling.', 'Re-embed everything if you change the embedding model.'] },
      { title: 'Retrieval: dense, sparse, or both', kicker: 'HYBRID SEARCH', body: 'Dense retrieval compares embeddings and finds matches in meaning even when the words differ. Sparse retrieval such as BM25 matches exact terms, and so excels with product codes, names, and acronyms that embeddings can blur. Hybrid search runs both and merges the results. Reciprocal Rank Fusion merges rankings using positions alone, which conveniently avoids comparing incompatible score scales.', example: 'Rank fusion with k = 60: rankings [a, b, c] and [c, a, d]. Document a scores 1/61 + 1/62 ≈ 0.03252. Document c scores 1/63 + 1/61 ≈ 0.03227. Document b gets only 1/62 ≈ 0.01613, and document d gets only 1/63 ≈ 0.01587. Appearing in both lists beats a single high rank.' },
      { title: 'Rerank, then generate', kicker: 'FROM CANDIDATES TO AN ANSWER', body: 'A cross-encoder reranker reads the query and each candidate together, which is more accurate but too slow for the whole corpus. So retrieve generously, perhaps 25–50 candidates, then rerank down to a few. Build a prompt that separates instructions from sources, requires citations, and tells the model to say so when the sources do not contain the answer. Retrieved text is untrusted input: a document can contain instructions meant to hijack the model, so never let it trigger sensitive actions without checks.', points: ['Retrieve broadly for recall, then rerank for precision.', 'Check that citations point to real, retrieved chunks.', 'Respect access controls during retrieval, so users see only permitted documents.'] },
      { title: 'Evaluate each stage separately', kicker: 'FIND THE BROKEN STEP', body: 'When an answer is wrong, the cause is usually either that the right chunk was not retrieved or that the model misused it. Measure these separately. Retrieval uses recall@k and MRR against a labeled question set. Generation uses faithfulness, which asks whether claims are supported by the sources, and answer relevance. Build the test set from real user questions, including ones with no answer in your documents, and rerun it after every change.', kind: 'math', example: 'If 40 of 50 test questions have their correct chunk in the top 5, recall@5 = 0.80. No prompt can fix the other 10 questions, so improve retrieval first.' },
    ],
    formula: '\\text{RRF}(d)=\\sum_{r\\in R}\\frac{1}{k+\\text{rank}_r(d)}', formulaExplanation: 'For each ranking r that contains document d, add 1 divided by k plus its position. k, commonly 60, dampens the advantage of the very top ranks. Documents ranked well by several retrievers rise to the top.',
    code: py`from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

chunks = [
    "Refunds are available within 30 days of purchase with a receipt.",
    "Standard shipping takes 3 to 5 business days within the country.",
    "Gift cards never expire and cannot be exchanged for cash.",
    "Refund requests after 30 days are reviewed by the support team.",
]

# Index: fit the vectorizer on the documents, not on the questions
vectorizer = TfidfVectorizer(stop_words="english")
index = vectorizer.fit_transform(chunks)

def retrieve(question, k=2):
    scores = cosine_similarity(vectorizer.transform([question]), index)[0]
    best = scores.argsort()[::-1][:k]
    return [(int(i), round(float(scores[i]), 3)) for i in best]

question = "How many days do I have to get a refund?"
results = retrieve(question)
print("retrieved:", results)

# Reciprocal rank fusion merges two rankings without comparing their scores
def reciprocal_rank_fusion(rankings, k=60):
    totals = {}
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            totals[doc] = totals.get(doc, 0) + 1 / (k + rank)
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)

fused = reciprocal_rank_fusion([["a", "b", "c"], ["c", "a", "d"]])
print("fused:", [(doc, round(score, 5)) for doc, score in fused])

context = "\n".join(f"[{i}] {chunks[i]}" for i, _ in results)
prompt = f"Answer using only the sources. Cite them.\n{context}\nQuestion: {question}"
print(prompt.splitlines()[0])`,
    codeOutput: 'retrieved: [(3, 0.483), (0, 0.153)]\nfused: [(\'a\', 0.03252), (\'c\', 0.03227), (\'b\', 0.01613), (\'d\', 0.01587)]\nAnswer using only the sources. Cite them.',
    codeExplanation: 'Look closely at the retrieval: chunk 0 is the best answer, but it ranks below chunk 3. The query says “refund” and chunk 0 says “Refunds”, so TF-IDF does not count them as the same term. Chunk 3 matches “refund” exactly. This is the core weakness of lexical search and why dense embeddings, stemming, and hybrid search exist. Printing retrieval results is the single most useful RAG debugging habit. This example stops at building the prompt, which you would send to an LLM.',
    practice: [
      { prompt: 'With k = 60, a document ranks 1st in one list and 4th in another. What is its RRF score?', answer: 'About 0.0320.', solution: '1/(60 + 1) + 1/(60 + 4) = 1/61 + 1/64 ≈ 0.01639 + 0.01563 ≈ 0.0320.' },
      { prompt: 'Users search for error code “ERR_4417” and the system returns unrelated results. What do you change?', answer: 'Add sparse keyword search, making the system hybrid.', solution: 'Embeddings tend to blur rare identifiers, so an exact code has little semantic meaning for them. BM25 gives rare exact matches high weight. Merge the two result lists with RRF so semantic questions keep working.' },
      { prompt: 'Your recall@5 is 0.95 but answers are often wrong. Where do you look next?', answer: 'At generation: the prompt, context ordering, and faithfulness.', solution: 'The right chunks are usually present, so retrieval is not the main issue. Inspect whether the model ignores sources, whether too much irrelevant context drowns them, or whether chunks lack needed context. Reranking to fewer chunks and stricter instructions often help. Measure faithfulness to confirm it.' },
    ],
    quiz: { question: 'An answer is wrong. What should you check first?', options: ['Switch to a larger model immediately', 'Whether the correct passage was actually retrieved', 'Raise the temperature'], answer: 1, explanation: 'B is correct: if the right text never reached the model, no model or prompt can reliably fix it. So check retrieval before changing generation. A is expensive and may not help, and C adds randomness rather than evidence.' },
    takeaways: ['RAG gives a model evidence at answer time, and documents update without retraining.', 'Hybrid search with reranking covers both meaning and exact terms.', 'Evaluate retrieval and generation separately, using real questions.'],
    interview: { question: 'When would you use RAG instead of fine-tuning?', answer: 'RAG suits knowledge that changes or must be cited, since you can update documents without retraining. Fine-tuning suits changing behavior, such as style, format, or a specialized task. They combine well: retrieve for facts, and fine-tune for how the answer is produced. I would normally try RAG first because it is cheaper to change and easier to audit.' },
    related: ['how-llms-generate-text', 'tokenization-and-embeddings', 'evaluation-metrics'],
    miniProject: { title: 'Ship a cited question-answering tool', objective: 'Build a small RAG system and measure it honestly.', tasks: ['Collect 20 or more documents you know well, such as course notes or product docs.', 'Chunk them, then build dense and BM25 indexes, merged with RRF.', 'Write 25 test questions with their expected source chunks, including 5 with no answer.', 'Measure recall@5, then generate answers with citations and check their faithfulness by hand.'], extension: 'Add a cross-encoder reranker and report whether it improves your metrics enough to justify its latency.' },
  },
]

export const productionLessons: LessonDraft[] = [
  {
    slug: 'serving-models', title: 'Serving models: from notebook to reliable service',
    description: 'A model is only useful if something can call it. Package it, guard its inputs, and measure the tail of your latency.',
    module: 'Production AI', difficulty: 'Advanced', estimatedMinutes: 16, prerequisites: ['feature-engineering-and-pipelines'],
    objectives: ['Choose batch, online, or streaming serving from a product need.', 'Package a model with its preprocessing and version, and validate inputs.', 'Read latency percentiles and pick a safe rollout strategy.'],
    analogy: 'A recipe that works once in your kitchen does not make a restaurant. A restaurant needs consistent ingredients, a way to reject bad orders, a target time per dish, and a way to try a new dish on a few tables before changing the whole menu.',
    intro: 'A notebook can show that a model works, but production asks different questions. What happens with malformed input? How slow is the slowest request? Which version answered this user? How do you roll back? Serving is mostly ordinary software engineering applied to an artifact that can fail silently, because a bad model returns a confident wrong answer instead of an error.',
    sections: [
      { title: 'Batch, online, or streaming', kicker: 'CHOOSE THE SIMPLEST THAT WORKS', body: 'Batch prediction runs on a schedule and stores results, which is cheap and simple, and it works when predictions can be slightly stale, such as nightly recommendations. Online serving answers each request within milliseconds, for cases like fraud checks at payment time. Streaming reacts to events as they arrive. Batch is often underrated: if predictions for all users can be computed overnight, you avoid running a low-latency service.', points: ['Batch: scores everything in advance, and new users have no prediction yet.', 'Online: fresh but requires low latency and high availability.', 'Streaming: responds to events, but needs more infrastructure.'] },
      { title: 'Package the whole pipeline', kicker: 'REPRODUCIBLE ARTIFACTS', body: 'Save preprocessing and model together with a version, the training data reference, metrics, and dependency versions. Mismatch between training and serving preprocessing, known as training-serving skew, is one of the most common production bugs. Pickle-based formats such as joblib can run arbitrary code when loaded, so only load artifacts you trust. ONNX and safetensors are safer and more portable alternatives for sharing and serving.', points: ['Record the model version in every prediction’s logs.', 'Pin dependency versions; a library upgrade can break a saved pickle.', 'Put models in a registry so a rollback is one step.'] },
      { title: 'Latency means percentiles', kicker: 'MEASURE THE TAIL', body: 'Averages hide the requests users complain about. The p95 is the value that 95% of requests finish under. Tail latency matters more than you might expect: a page that makes 10 calls will often be held back by its slowest call. Reduce latency through smaller models, quantization, caching repeated requests, and batching on GPUs, which raises throughput but adds a little wait for each request.', example: 'For 20 latencies whose mean is 55.1 ms, the p50 is 29 ms, but one request took 480 ms and the p95 is 109.5 ms. The mean describes almost nobody’s actual experience here. Report p50, p95, and p99 against a target, such as “p95 under 100 ms”.' },
      { title: 'Roll out without betting everything', kicker: 'SAFE DEPLOYMENT', body: 'A shadow deployment sends a copy of live traffic to the new model and logs its answers without showing them, which tests it with no user risk. A canary gives it a small share of real traffic, such as 5%, and then gradually more if metrics hold. An A/B test measures the business effect with a statistically sound comparison. Always keep a one-step rollback and a fallback, such as the previous model or a simple rule, for when the model is unavailable.', kind: 'math', points: ['Shadow: checks stability and agreement with no user impact.', 'Canary: limits the blast radius with real traffic.', 'A/B: measures whether the model actually improves the product.'] },
    ],
    formula: 'p_{95} = \\min\\{t : P(\\text{latency} \\le t) \\ge 0.95\\}', formulaExplanation: 'The p95 is the smallest time such that at least 95% of requests finish within it. Software often interpolates between neighboring samples, as NumPy does in the example below, so results from different tools can differ slightly.',
    code: py`import io
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

# Train and save the whole pipeline, so preprocessing ships with the model
X = np.array([[1.0, 200.0], [2.0, 150.0], [8.0, 40.0], [9.0, 30.0]])
y = np.array([0, 0, 1, 1])
pipeline = make_pipeline(StandardScaler(), LogisticRegression()).fit(X, y)

artifact = io.BytesIO()
joblib.dump({"model": pipeline, "version": "2026-11-01"}, artifact)
artifact.seek(0)
loaded = joblib.load(artifact)

def predict(payload):
    # Validate at the boundary: reject bad input instead of guessing
    visits, spend = payload.get("visits"), payload.get("spend")
    if not isinstance(visits, (int, float)) or not isinstance(spend, (int, float)):
        return {"error": "visits and spend must be numbers"}
    if visits < 0 or spend < 0:
        return {"error": "visits and spend cannot be negative"}
    probability = loaded["model"].predict_proba([[visits, spend]])[0][1]
    return {"probability": round(float(probability), 2), "model_version": loaded["version"]}

print(predict({"visits": 8, "spend": 35}))
print(predict({"visits": "many", "spend": 35}))
print(predict({"visits": -1, "spend": 35}))

# Report tail latency: a good average can hide very slow requests
latencies_ms = np.array([18, 20, 21, 22, 22, 23, 24, 25, 26, 28, 30, 31, 33, 35, 38, 40, 44, 52, 90, 480])
print("mean:", latencies_ms.mean(), "p50:", np.percentile(latencies_ms, 50), "p95:", round(np.percentile(latencies_ms, 95), 1))`,
    codeOutput: '{\'probability\': 0.79, \'model_version\': \'2026-11-01\'}\n{\'error\': \'visits and spend must be numbers\'}\n{\'error\': \'visits and spend cannot be negative\'}\nmean: 55.1 p50: 29.0 p95: 109.5',
    codeExplanation: 'Saving a dictionary keeps the model and its version together, so each response can report which model produced it. `predict` rejects bad input with a clear message, because a model handed garbage still returns a number. In a real service this function would sit behind a framework such as FastAPI, with validation through Pydantic. The `BytesIO` buffer stands in for a file so that the example leaves nothing on disk.',
    practice: [
      { prompt: 'A page calls 5 services, and each is independently slow 5% of the time. How often does a page load hit at least one slow call?', answer: 'About 22.6% of the time.', solution: 'The chance that all five are fast is 0.95⁵ ≈ 0.774, so the chance of at least one being slow is 1 − 0.774 ≈ 0.226. This is why tail latency matters.' },
      { prompt: 'A retailer refreshes product recommendations once a day and they are read on page load. Which serving pattern fits?', answer: 'Batch prediction with stored results.', solution: 'Predictions can be computed nightly and looked up in a fast store, so there is no low-latency model service to run. A fallback for new users, such as popular items, is the main addition.' },
      { prompt: 'Offline accuracy is 92%, but the same model scores far lower in production with no errors in the logs. What do you check first?', answer: 'Training-serving skew in the preprocessing.', solution: 'Compare the actual feature values reaching the model against training data. Typical causes are different scaling, a default value for a missing feature, changed units, or features computed differently online. Logging inputs and using one shared pipeline both help prevent it.' },
    ],
    quiz: { question: 'Why report p95 latency rather than only the mean?', options: ['The mean is hard to compute', 'The mean can hide slow requests that affect real users', 'p95 is always lower than the mean'], answer: 1, explanation: 'B is correct: a few very slow requests can be masked by many fast ones, and users feel those slow ones. A is false. C is false as well: p95 is usually higher than the mean, although a few extreme outliers can reverse that, which is itself a reason to look at several percentiles.' },
    takeaways: ['Use the simplest serving pattern that meets the need; batch is often enough.', 'Ship preprocessing and model together, with a version on every prediction.', 'Measure percentiles, and roll out through shadow and canary stages with a rollback ready.'],
    interview: { question: 'What is training-serving skew and how do you prevent it?', answer: 'It is a difference between the data or feature logic used in training and what the model sees in production. I prevent it by sharing one preprocessing pipeline, using a feature store when that is justified, logging serving inputs, and comparing their distributions with the training data.' },
    related: ['feature-engineering-and-pipelines', 'monitoring-and-drift', 'evaluation-metrics'],
    miniProject: { title: 'Wrap a model in a real API', objective: 'Build a small, honest prediction service.', tasks: ['Train a scikit-learn pipeline and save it with its version.', 'Serve it through FastAPI, with a Pydantic schema that validates input.', 'Add `/health`, and log the version and latency for every request.', 'Run a load test with `locust` or `hey`, and report p50, p95, and p99.'], extension: 'Package it in Docker and add a shadow route that logs a second model’s predictions without returning them.' },
  },
  {
    slug: 'monitoring-and-drift', title: 'Monitoring and drift: keeping models honest',
    description: 'A deployed model decays quietly because the world changes. Learn what to watch and when to act.',
    module: 'Production AI', difficulty: 'Advanced', estimatedMinutes: 15, prerequisites: ['serving-models', 'evaluation-metrics'],
    objectives: ['Distinguish data drift, concept drift, and data quality failures.', 'Calculate the Population Stability Index by hand.', 'Design monitoring and a retraining policy when labels arrive late.'],
    analogy: 'A weather model trained on past decades can slowly become less accurate as the climate shifts, even though no code has changed. Nothing crashes, and the forecasts look just as confident. You only find out by continuing to compare predictions against what actually happens.',
    intro: 'Normal software usually fails loudly. A model usually fails silently: the API returns 200, and the predictions look normal, but they are becoming wrong. Users change, products launch, upstream teams rename columns, and fraudsters adapt. Monitoring means detecting these changes before they turn into bad decisions, and that includes the hard case where true labels arrive weeks later.',
    sections: [
      { title: 'What actually changes', kicker: 'KINDS OF DRIFT', body: 'Data drift (covariate shift) means the input distribution P(x) changes, such as a marketing campaign bringing in younger users. Concept drift means the relationship P(y | x) changes, so the same inputs now lead to different outcomes, as when fraud tactics change or a pandemic alters shopping. Label drift means the outcome rates shift. Data drift does not always harm a model, whereas concept drift generally does. Most real incidents, however, are plain data quality failures.', points: ['Data drift: inputs look different.', 'Concept drift: the right answer for the same input has changed.', 'Data quality: a pipeline broke, such as a unit change or a column filled with nulls.'] },
      { title: 'Measure drift with PSI', kicker: 'POPULATION STABILITY INDEX', body: 'PSI compares how a feature’s values fall across fixed bins now versus in a reference period. The bin edges come from the reference data and stay fixed. A common rule of thumb reads below 0.1 as stable, 0.1–0.25 as moderate change, and above 0.25 as a significant shift. These thresholds are conventions rather than laws, so calibrate them on your own history. With very large samples, statistical tests such as Kolmogorov–Smirnov flag trivially small differences, so effect size is often more useful.', example: 'Reference shares are [0.25, 0.25, 0.25, 0.25] and current shares are [0.1, 0.2, 0.3, 0.4]. Sum (a − e) × ln(a / e): (−0.15)(−0.916) + (−0.05)(−0.223) + (0.05)(0.182) + (0.15)(0.470) ≈ 0.137 + 0.011 + 0.009 + 0.071 = 0.228, which is moderate and close to the action threshold.' },
      { title: 'Layers of monitoring', kicker: 'WHAT TO WATCH', body: 'Watch several layers, from cheapest to most valuable. Service health covers errors, latency, and traffic. Data quality covers null rates, ranges, and schema. Distribution checks cover input and prediction drift. Model quality compares predictions with true labels. Business metrics show actual impact. When labels arrive late, such as loan defaults after months, prediction drift and data checks act as early warnings, and a sample of human-labeled cases can fill the gap.', points: ['Alert on things someone can act on, or alerts will be ignored.', 'Slice metrics by segment, since an average can hide a failing group.', 'Beware feedback loops, where the model’s decisions affect which outcomes you see.'] },
      { title: 'When to retrain', kicker: 'A POLICY, NOT A REFLEX', body: 'Retraining on a schedule is simple and works when change is gradual. Triggered retraining reacts to monitored drops. Either way, treat each retrained model as a new release: validate it against the current model on recent data, and roll it out gradually. Automatically deploying whatever comes out of training is risky, since it can learn from a broken pipeline. And retraining cannot fix a data outage, so diagnose first.', kind: 'math', points: ['Evaluate on the most recent period, using a time-based split.', 'Compare with the current model before promoting.', 'Keep the previous version ready for rollback.'] },
    ],
    formula: '\\text{PSI}=\\sum_{i}(a_i-e_i)\\ln\\frac{a_i}{e_i}', formulaExplanation: 'eᵢ and aᵢ are the shares of data in bin i for the reference and current periods. Each term is nonnegative, because (a − e) and ln(a / e) always share a sign, so PSI is 0 only when the distributions match across bins. A small floor prevents log(0) in empty bins.',
    code: py`import numpy as np

def population_stability_index(expected, actual, bins=10, floor=1e-4):
    # Bin edges come from the reference data and stay fixed
    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    expected_share = np.histogram(expected, edges)[0] / len(expected)
    actual_share = np.histogram(actual, edges)[0] / len(actual)
    # A floor stops an empty bin from producing log(0)
    expected_share = np.clip(expected_share, floor, None)
    actual_share = np.clip(actual_share, floor, None)
    return float(np.sum((actual_share - expected_share) * np.log(actual_share / expected_share)))

# The hand calculation from this lesson
hand = (np.array([0.1, 0.2, 0.3, 0.4]) - 0.25) * np.log(np.array([0.1, 0.2, 0.3, 0.4]) / 0.25)
print("hand PSI:", round(float(hand.sum()), 3))

rng = np.random.default_rng(7)
reference = rng.normal(50, 10, 10_000)
print("same distribution:", round(population_stability_index(reference, rng.normal(50, 10, 10_000)), 3))
print("small shift:", round(population_stability_index(reference, rng.normal(52, 10, 10_000)), 3))
print("large shift:", round(population_stability_index(reference, rng.normal(60, 12, 10_000)), 3))`,
    codeOutput: 'hand PSI: 0.228\nsame distribution: 0.001\nsmall shift: 0.047\nlarge shift: 0.745',
    codeExplanation: 'Quantile edges give each reference bin about the same share of data, and setting the outer edges to infinity catches new values outside the old range. Two samples from the same distribution give a PSI near 0. A 0.2-standard-deviation shift stays under the 0.1 line, so it would pass unnoticed by this rule, and only you can decide whether that is acceptable. A shift of one standard deviation with a wider spread is unmistakable.',
    practice: [
      { prompt: 'A bin’s reference share is 0.2 and its current share is 0.4. What is that bin’s PSI contribution?', answer: 'About 0.139.', solution: '(0.4 − 0.2) × ln(0.4 / 0.2) = 0.2 × ln 2 ≈ 0.2 × 0.693 ≈ 0.139.' },
      { prompt: 'Input distributions look stable, but fraud losses are climbing fast. What kind of drift is most likely?', answer: 'Concept drift.', solution: 'The inputs look the same, but their relationship with the outcome has changed, since attackers adapted. Input drift checks would not detect this. Performance on recently confirmed labels and a review of high-value cases would.' },
      { prompt: 'Overnight, a feature’s average jumps from 170 to 67. What do you suspect first, and what do you do?', answer: 'A unit or pipeline change, not real-world drift. Fix the pipeline rather than retraining.', solution: 'A sudden step usually means a pipeline issue, such as height changing from centimeters to inches, since 170 cm ≈ 67 in. Retraining would just bake in the bug. Check upstream changes, add range checks, and consider a fallback while it is fixed.' },
    ],
    quiz: { question: 'True labels arrive 90 days after each prediction. What can you monitor today?', options: ['Nothing until the labels arrive', 'Input drift, prediction distribution, and data quality as early signals', 'Only server uptime'], answer: 1, explanation: 'B is correct: these need no labels and can warn you early, even though they do not directly measure accuracy. A leaves you blind for months. C misses silent model failure, because a service can be up and still be wrong.' },
    takeaways: ['Models fail silently, so service health alone is not enough.', 'Separate data drift, concept drift, and data quality failures, because each has a different fix.', 'Treat retraining as a validated release, not an automatic reflex.'],
    interview: { question: 'How would you monitor a model when ground-truth labels are delayed?', answer: 'I would track data quality, input drift, and prediction drift as leading indicators, sample recent predictions for human labeling, and use proxy outcomes that arrive sooner, such as a late-payment flag for a loan default model. When real labels arrive, I would backfill performance by cohort to confirm whether the early signals were right.' },
    related: ['serving-models', 'evaluation-metrics', 'responsible-ai'],
    miniProject: { title: 'Simulate a drifting model', objective: 'Watch a model decay and test whether your monitoring would have caught it.', tasks: ['Train a classifier on a synthetic dataset, and treat that as your reference period.', 'Generate 12 monthly batches with gradual covariate shift, then introduce concept drift in month 8.', 'Plot PSI per feature and true accuracy per month on the same chart.', 'Write down when an alert would have fired, and whether each kind of drift was detectable before accuracy dropped.'], extension: 'Add monthly and triggered retraining, then compare accuracy and the number of retrains for each.' },
  },
  {
    slug: 'responsible-ai', title: 'Responsible AI: fairness, documentation, and risk',
    description: 'A model can look accurate overall and still fail specific people. Measure it, document it, and decide deliberately.',
    module: 'Production AI', difficulty: 'Advanced', estimatedMinutes: 16, prerequisites: ['evaluation-metrics'],
    objectives: ['Calculate selection rate, TPR, and FPR per group.', 'Explain why common fairness definitions can conflict.', 'Write a useful model card and decide when not to automate.'],
    analogy: 'A bridge is not safe because the average truck crosses it. Engineers document load limits, inspect for specific failure modes, and sometimes close it. Responsible AI brings the same habit to models: state the limits, test where it could fail, and accept that sometimes the right answer is not to build the thing.',
    intro: 'A high overall score can hide serious harm to a small group. Data records past decisions, including unfair ones, and removing a sensitive column does not fix that, because other features act as proxies. Responsible AI is not a separate checkbox. It is the same evidence-based discipline as the rest of this course: define the harm you care about, measure it, and make the trade-offs explicit and owned by someone.',
    sections: [
      { title: 'Where harm comes from', kicker: 'BEFORE THE MODEL', body: 'Bias enters long before training. Historical bias means labels encode past decisions: a model trained on who was hired learns who was hired before, not who would do well. Representation bias means some groups have too few examples. Measurement bias means the target is a poor proxy, such as using healthcare spending to stand in for health need, when groups with less access spend less for the same illness. Dropping a sensitive attribute rarely helps, since postcode or name can reveal it.', points: ['Ask what the label actually measures.', 'Check who is missing or underrepresented in the data.', 'Look for proxies of sensitive attributes among the features.'] },
      { title: 'Measure by group', kicker: 'DISAGGREGATED EVALUATION', body: 'Always break metrics down by relevant groups. Selection rate is the share of a group receiving the positive decision. True positive rate (TPR) is the share of truly positive people who are identified. False positive rate (FPR) is the share of truly negative people wrongly flagged. Small groups give noisy estimates, so report the counts and confidence intervals too, not just a percentage.', example: 'In the code below, both groups have 80% accuracy. But group A has selection rate 0.6, TPR 0.83, and FPR 0.25, while group B has selection rate 0.3, TPR 0.67, and FPR 0.14. Equal accuracy hides the fact that qualified people in group B are missed more often.' },
      { title: 'Fairness definitions conflict', kicker: 'A CHOICE, NOT A CALCULATION', body: 'Demographic parity asks for equal selection rates. Equal opportunity asks for equal TPR. Equalized odds asks for equal TPR and FPR. Predictive parity asks for equal precision. When base rates differ between groups, a model that is not perfect generally cannot satisfy calibration and equal error rates at the same time. So fairness cannot be fully automated. Someone has to choose, based on the context and who bears the cost of each mistake.', kind: 'math', points: ['Which mistake harms people most in this decision?', 'Is the label itself trustworthy across groups?', 'Who was consulted, and who is accountable for the choice?'] },
      { title: 'Document and decide', kicker: 'MODEL CARDS AND RISK', body: 'A model card records intended use, out-of-scope uses, data, group-level metrics, limitations, and contacts. Also think about privacy: models can memorize personal data, and LLM apps can leak what they are given. Think about security too, including prompt injection in LLM systems. For high-stakes areas such as hiring, credit, and health, check applicable regulations, and provide a way for people to appeal to a human. Sometimes the responsible conclusion is not to automate at all.', example: 'A useful limitation reads: “Trained on adult patients at three hospitals. Not evaluated on children. Recall drops from 0.91 to 0.74 for scans from older machines.” Someone can act on that. “The model may have limitations” says nothing.' },
    ],
    formula: '\\text{TPR}_g=\\frac{TP_g}{TP_g+FN_g} \\qquad \\text{FPR}_g=\\frac{FP_g}{FP_g+TN_g}', formulaExplanation: 'The same formulas as in evaluation metrics, but calculated separately for each group g. Equal opportunity compares TPR across groups, and equalized odds compares both TPR and FPR.',
    code: py`import numpy as np

# Labels and decisions for two groups with different base rates
group = np.array(["A"] * 10 + ["B"] * 10)
actual = np.array([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
predicted = np.array([1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0])

print("group | selected | TPR | FPR | precision")
for name in ("A", "B"):
    mask = group == name
    y, p = actual[mask], predicted[mask]
    selected = p.mean()
    tpr = p[y == 1].mean()
    fpr = p[y == 0].mean()
    precision = y[p == 1].mean()
    print(name, round(float(selected), 2), round(float(tpr), 2), round(float(fpr), 2), round(float(precision), 2))

overall = (actual == predicted).mean()
print("overall accuracy:", round(float(overall), 2))`,
    codeOutput: 'group | selected | TPR | FPR | precision\nA 0.6 0.83 0.25 0.83\nB 0.3 0.67 0.14 0.67\noverall accuracy: 0.8',
    codeExplanation: 'Selection rate needs no labels, while TPR and FPR condition on the true label, and precision conditions on the prediction. Group A has a higher base rate (6 of 10 positive) than group B (3 of 10). Equalizing selection rates would force a different kind of error somewhere else. With 10 examples per group, these numbers are for illustrating the calculation: real audits need larger samples and confidence intervals. Libraries such as Fairlearn make this easy to repeat.',
    practice: [
      { prompt: 'Group G has TP = 30, FN = 20, FP = 10, TN = 40. Calculate its selection rate, TPR, and FPR.', answer: 'Selection rate 0.40, TPR 0.60, FPR 0.20.', solution: 'There are 100 people, and 30 + 10 = 40 received the positive decision, so the selection rate is 0.40. TPR = 30 / (30 + 20) = 0.60. FPR = 10 / (10 + 40) = 0.20.' },
      { prompt: 'A team removes “gender” from a hiring model and says it is now fair. What is wrong with that reasoning?', answer: 'Other features can act as proxies, and the labels may still encode past bias.', solution: 'Features such as college, activities, or career gaps can reveal gender, and past hiring decisions used as labels may already be skewed. Removing a column also makes bias harder to measure. Audit outcomes by group, using the attribute for evaluation where lawful.' },
      { prompt: 'A screening tool has much higher FPR for one group, and a positive result triggers an invasive test. Which metric gap matters most here, and why?', answer: 'The FPR gap, because false positives cause the direct harm.', solution: 'A false positive sends a healthy person into an invasive procedure, and this burden falls more on one group. Investigate the causes, consider group-aware thresholds where lawful and appropriate, and report the trade-off in terms of recall. Clinicians and affected people should be part of that decision.' },
    ],
    quiz: { question: 'Two groups have identical overall accuracy. What can you conclude?', options: ['The model treats both groups fairly', 'Very little: their false positive and false negative rates may differ a lot', 'The data must be perfectly balanced'], answer: 1, explanation: 'B is correct: the same accuracy can come from very different mixes of errors, which is exactly what the code example shows. A is the mistake this lesson warns about. C does not follow from equal accuracy.' },
    takeaways: ['Bias enters through labels, representation, and measurement, long before training.', 'Always evaluate by group, and report sample sizes along with the rates.', 'Fairness definitions can conflict, so the choice must be explicit, documented, and owned by people.'],
    interview: { question: 'Is removing protected attributes enough to make a model fair?', answer: 'No. Other features can act as proxies, and labels may carry historical bias. It can also stop you from measuring the problem. I would evaluate outcomes by group, examine the label and data sources, choose fairness criteria with stakeholders, and document the trade-offs and remaining risks.' },
    related: ['evaluation-metrics', 'monitoring-and-drift', 'train-validation-test'],
    miniProject: { title: 'Audit a model and write its card', objective: 'Run a group-level audit, then document what you found.', tasks: ['Train a classifier on the Adult Income dataset from OpenML.', 'Use Fairlearn’s `MetricFrame` to report selection rate, TPR, and FPR by sex and race, along with counts.', 'Try one mitigation, such as group-specific thresholds, and quantify its cost in overall accuracy.', 'Write a one-page model card covering intended use, out-of-scope uses, results by group, and limitations.'], extension: 'Bootstrap confidence intervals for your group metrics, and decide which gaps are large enough to matter.' },
  },
]
