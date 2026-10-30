# Lesson Content Audit

Audit date: 2026-10-19

## Scope

The content store contains 17 published lessons: eight ML foundations and nine new Deep Learning lessons. Curriculum entries with empty `lessonSlugs` are roadmap placeholders, not lessons.

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

PyTorch is not installed in the available workspace interpreter, so the examples were checked for Python syntax and their numerical demonstrations were hand-verified, but framework execution is not claimed. Run them in an environment with a compatible PyTorch install before using them in production work.

## Roadmap Placeholders

- The dedicated Computer Vision, Language & LLMs, and Production AI modules still have no published lesson slugs. Introductory CNN content is currently part of the Deep Learning course.
- The current module list does not yet contain dedicated mathematics, statistics/probability, NLP, research, or MLOps lesson collections.
- The Projects page has three guided briefs, not the requested full project catalog; dataset attribution, runnable project code, and licenses are not supplied.
- Interview prep has four foundational prompts, not the requested role-specific question banks.

These gaps are intentionally visible in the curriculum rather than represented as completed material.
