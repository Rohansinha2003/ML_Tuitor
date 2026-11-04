# Lesson Content Audit

Audit date: 2026-11-04

## Scope

The content store contains 29 published lessons across eight modules. Every module has published lessons, and lesson numbers are assigned from curriculum order in `src/content/lessons.ts`, so the numbers below are the original authoring labels.

## Published Lessons

| Lesson | Audit result |
| --- | --- |
| 01 — What is machine learning? | Expanded: clearer task/data/model vocabulary, a numeric prediction and residual, a runnable labeled-text classifier, expected output, and step-by-step exercise solutions. |
| 02 — Supervised vs. unsupervised learning | Expanded: features/targets, when-to-use guidance, numeric clustering example, runnable regression and clustering examples, and reasoned solutions. |
| 03 — Linear regression | Expanded: slope/intercept interpretation, least-squares arithmetic, residuals and MSE calculated by hand, assumptions, runnable code, and worked solutions. |
| 04 — Train, validation, and test data | Expanded: split roles, a 700/150/150 example, time/group leakage, train-only preprocessing, cross-validation, a runnable three-way split pipeline, and worked solutions. |
| 05 — Gradient descent | Expanded: derivative and gradient intuition, three manual updates, learning-rate stability/oscillation, a runnable loop with matching output, and worked solutions. |
| 06 — Overfitting and underfitting | Expanded: deterministic `make_moons` data, untouched test split, verified tree-depth score table, learning-curve reasoning, regularization/data diagnostics, worked exercises, and a model-selection mini project. |
| 07 — Evaluation metrics | Expanded: worked confusion-matrix counts, specificity, threshold trade-offs, calibration, ROC/PR context, regression metrics, detailed solutions, and a fraud-threshold mini project. |
| 08 — Neural networks | Expanded: hand-calculated neuron and two-layer forward pass, MSE arithmetic, complete forward/loss/backprop/update order, deterministic XOR PyTorch training example, worked exercises, and an XOR mini project. |

## Deep Learning Course

| Lesson | Coverage |
| --- | --- |
| 09 — Perceptrons | Threshold unit, weighted score, update by hand, linear-separability limit, runnable PyTorch calculation, AND/XOR mini project. |
| 10 — Activations and losses | ReLU, sigmoid, tanh, Leaky ReLU, GELU, softmax, MSE, and classification cross-entropy; logits/probabilities distinction. |
| 11 — Forward propagation | Tensor dimensions, layer-by-layer numerical example, deterministic PyTorch weights, output and loss. |
| 12 — Backpropagation | Chain rule through a scalar model, exact gradient/update, autograd, gradient clearing, and training-loop order. |
| 13 — Optimizers | SGD, momentum, RMSprop, Adam, learning-rate behavior, validation curves, and a runnable comparison scaffold. |
| 14 — CNNs | Image tensor layout, convolution arithmetic, stride, padding, pooling, and a deterministic PyTorch convolution. |
| 15 — RNNs and LSTMs | Hidden-state recurrence, hand-calculated steps, vanishing/exploding gradients, gates, and PyTorch output shapes. |
| 16 — Attention | Query/key/value, scaled dot-product arithmetic, masks, multiple heads, and a runnable tensor example. |
| 17 — Transformers | Embeddings, position, transformer blocks, causal language modeling, architecture families, limits, and a PyTorch causal-stack example. |

## Applied Lessons

| Module | Lessons |
| --- | --- |
| Supervised learning | Logistic regression; decision trees, random forests, and boosting; feature engineering and leak-proof pipelines. |
| Computer vision | Image data and augmentation; transfer learning; object detection and segmentation. |
| Language & LLMs | Tokens and embeddings; how LLMs generate text; retrieval-augmented generation. |
| Production AI | Serving models; monitoring and drift; responsible AI. |

## Added to Every Lesson

- Common mistakes, each paired with its fix.
- Further reading, with every link checked for an HTTP 200 on the audit date.

## Verification

All 29 code examples were executed on 2026-11-04 with Python 3.9, PyTorch 2.8.0 (CPU), scikit-learn 1.6.1, and NumPy 2.0.2, and their printed output matches the published output exactly. That run corrected the published output of two lessons and added the missing output of four. To repeat it:

```sh
npx tsx server/scripts/check-lessons.ts /path/to/python
```

Seeded results can differ across library versions and hardware, particularly the optimizer and neural network examples.

Hand calculations in the new lessons were checked against the code where the code computes them. Prose has not had an independent review by a subject expert.

## Known Gaps

- Each lesson has a single quiz question.
- Project briefs name suggested datasets, but dataset licenses must be confirmed before publishing work based on them.
- Interview prep has 31 foundational questions, not role-specific question banks.
