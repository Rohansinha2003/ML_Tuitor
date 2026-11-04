export type LessonExtras = {
  commonMistakes: { mistake: string; fix: string }[]
  furtherReading: { title: string; url: string; note: string }[]
}

const crashCourse = { title: 'Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', note: 'Google’s free introduction, with short exercises.' }
const d2l = (title: string, path: string, note: string) => ({ title, url: `https://d2l.ai/${path}`, note })
const sklearn = (title: string, path: string, note: string) => ({ title, url: `https://scikit-learn.org/stable/${path}`, note })
const arxiv = (title: string, id: string, note: string) => ({ title, url: `https://arxiv.org/abs/${id}`, note })

export const lessonExtras: Record<string, LessonExtras> = {
  'what-is-machine-learning': {
    commonMistakes: [
      { mistake: 'Reaching for ML when a simple rule would do.', fix: 'If you can write the rule and it stays stable, write it. It is cheaper to run, easier to test, and simpler to explain. Use ML when the rules are too many or keep changing.' },
      { mistake: 'Judging a model by how it does on its training examples.', fix: 'A model can memorize what it has seen. Always evaluate on examples held back from training.' },
      { mistake: 'Treating a prediction as a fact.', fix: 'Outputs are estimates shaped by the training data. Decide what happens when the model is wrong before you rely on it.' },
    ],
    furtherReading: [crashCourse, { title: 'Rules of Machine Learning', url: 'https://developers.google.com/machine-learning/guides/rules-of-ml', note: 'Practical advice, starting with whether you need ML at all.' }],
  },
  'supervised-vs-unsupervised': {
    commonMistakes: [
      { mistake: 'Naming clusters and treating the names as discovered truth.', fix: 'Cluster ids are arbitrary. Inspect the members, test stability across runs, and check whether the groups help a real decision.' },
      { mistake: 'Clustering without scaling features.', fix: 'Distance-based methods let large-range features dominate. Standardize first unless the raw scale is meaningful.' },
      { mistake: 'Assuming supervised is always better because it has labels.', fix: 'Labels can be expensive, noisy, or biased. Check how the labels were produced before trusting what they teach.' },
    ],
    furtherReading: [sklearn('Supervised learning guide', 'supervised_learning.html', 'A map of supervised methods with examples.'), sklearn('Unsupervised learning guide', 'unsupervised_learning.html', 'Clustering, decomposition, and density estimation.')],
  },
  'train-validation-test': {
    commonMistakes: [
      { mistake: 'Checking the test score repeatedly while tuning.', fix: 'Each look makes the estimate more optimistic. Tune on validation data, and open the test set once.' },
      { mistake: 'Fitting preprocessing before splitting.', fix: 'Split first, then fit scalers and imputers inside a pipeline so they only see training rows.' },
      { mistake: 'Random splits on grouped or time-ordered data.', fix: 'Keep one person’s records on one side using `GroupKFold`, and use `TimeSeriesSplit` when predicting the future.' },
    ],
    furtherReading: [sklearn('Cross-validation', 'modules/cross_validation.html', 'Splitters for groups, time series, and stratification.'), sklearn('Common pitfalls and recommended practices', 'common_pitfalls.html', 'Worked examples of leakage and how to avoid it.')],
  },
  'linear-regression': {
    commonMistakes: [
      { mistake: 'Reading coefficients as causal effects.', fix: 'A coefficient describes association given the other features. Causal claims need a design that supports them.' },
      { mistake: 'Comparing coefficients across unscaled features.', fix: 'A weight depends on its feature’s units. Standardize features before comparing their sizes.' },
      { mistake: 'Trusting a high R² without looking at residuals.', fix: 'Plot residuals against predictions. A curve or a fan shape means the model is missing structure, whatever the score says.' },
    ],
    furtherReading: [sklearn('Linear models', 'modules/linear_model.html', 'Ordinary least squares, Ridge, Lasso, and logistic regression.'), crashCourse],
  },
  'logistic-regression': {
    commonMistakes: [
      { mistake: 'Treating predicted probabilities as calibrated by default.', fix: 'Regularization and imbalance can distort probabilities. Check with a calibration curve before acting on the exact values.' },
      { mistake: 'Accepting the 0.5 threshold automatically.', fix: 'Choose the threshold on validation data, based on what each kind of mistake costs.' },
      { mistake: 'Forgetting that the regularization default affects your weights.', fix: 'scikit-learn applies L2 by default. Scale features and tune `C`, especially when you plan to interpret the coefficients.' },
    ],
    furtherReading: [sklearn('Logistic regression in scikit-learn', 'modules/linear_model.html#logistic-regression', 'Solvers, penalties, and multiclass options.'), sklearn('Probability calibration', 'modules/calibration.html', 'How to check and correct predicted probabilities.')],
  },
  'decision-trees-and-ensembles': {
    commonMistakes: [
      { mistake: 'Letting a single tree grow without limits.', fix: 'Set `max_depth` or `min_samples_leaf` and tune them with cross-validation.' },
      { mistake: 'Trusting impurity-based feature importance.', fix: 'It favors high-cardinality features and is computed on training data. Prefer permutation importance on held-out data.' },
      { mistake: 'Expecting trees to extrapolate.', fix: 'Tree predictions stay within the range of training targets. For trending data, add features that capture the trend or use a linear component.' },
    ],
    furtherReading: [sklearn('Decision trees', 'modules/tree.html', 'How they work, with practical tips.'), sklearn('Ensemble methods', 'modules/ensemble.html', 'Random forests, gradient boosting, and histogram-based boosting.'), { title: 'Introduction to Boosted Trees', url: 'https://xgboost.readthedocs.io/en/stable/tutorials/model.html', note: 'A clear derivation of the boosting objective.' }],
  },
  'feature-engineering-and-pipelines': {
    commonMistakes: [
      { mistake: 'Preprocessing the whole dataset, then cross-validating.', fix: 'Put every learned step in a `Pipeline` and pass that to `cross_val_score`.' },
      { mistake: 'Using a feature that is not available at prediction time.', fix: 'For every column, ask when it is recorded. Anything recorded after the outcome is leakage.' },
      { mistake: 'Letting a new category crash production.', fix: 'Use `OneHotEncoder(handle_unknown="ignore")` and test with an unseen value.' },
    ],
    furtherReading: [sklearn('Pipelines and composite estimators', 'modules/compose.html', 'Pipeline and ColumnTransformer in depth.'), sklearn('Preprocessing data', 'modules/preprocessing.html', 'Scaling, encoding, and transformations.')],
  },
  'gradient-descent': {
    commonMistakes: [
      { mistake: 'Blaming the model when the learning rate is the problem.', fix: 'Plot the loss. If it rises or oscillates, lower the rate before changing anything else.' },
      { mistake: 'Skipping feature scaling.', fix: 'Very different feature scales create a long, narrow loss surface that converges slowly. Standardize inputs first.' },
      { mistake: 'Assuming lower training loss means a better model.', fix: 'Track validation loss too. Training loss can keep falling while the model gets worse on new data.' },
    ],
    furtherReading: [d2l('Optimization Algorithms', 'chapter_optimization/index.html', 'From gradient descent to modern optimizers, with code.'), { title: 'Deep Learning, Chapter 8', url: 'https://www.deeplearningbook.org/contents/optimization.html', note: 'A rigorous treatment from Goodfellow, Bengio, and Courville.' }],
  },
  'overfitting-underfitting': {
    commonMistakes: [
      { mistake: 'Adding regularization before checking for leakage or duplicates.', fix: 'Duplicates across splits and leakage distort the gap. Audit the data first.' },
      { mistake: 'Reading a small validation set as precise.', fix: 'With few examples, a score moves a lot by chance. Use cross-validation or report uncertainty.' },
      { mistake: 'Calling it overfitting when both errors are high.', fix: 'High training and validation error is underfitting. Use more capacity or better features rather than more regularization.' },
    ],
    furtherReading: [sklearn('Validation curves and learning curves', 'modules/learning_curve.html', 'How to plot the diagnostics from this lesson.'), crashCourse],
  },
  'evaluation-metrics': {
    commonMistakes: [
      { mistake: 'Reporting accuracy on imbalanced data.', fix: 'Show the confusion matrix, with precision and recall for the class you care about.' },
      { mistake: 'Choosing the threshold on the test set.', fix: 'Choose it on validation data, then report once on the test set.' },
      { mistake: 'Optimizing a metric the business does not care about.', fix: 'Agree on the costs of each error first, then pick the metric that reflects them.' },
    ],
    furtherReading: [sklearn('Metrics and scoring', 'modules/model_evaluation.html', 'Every common metric, and how to choose one.'), { title: 'ML Glossary', url: 'https://developers.google.com/machine-learning/glossary', note: 'Short, precise definitions of the terms in this lesson.' }],
  },
  'neural-networks': {
    commonMistakes: [
      { mistake: 'Starting with a large network.', fix: 'First overfit a tiny batch with a small network. If that fails, you have a bug, and more layers will only hide it.' },
      { mistake: 'Applying softmax or sigmoid before a loss that expects logits.', fix: '`CrossEntropyLoss` and `BCEWithLogitsLoss` take raw logits. Applying an activation first quietly hurts training.' },
      { mistake: 'Forgetting `optimizer.zero_grad()`.', fix: 'PyTorch accumulates gradients, so clear them at each step or they mix across batches.' },
    ],
    furtherReading: [{ title: 'Neural Networks and Deep Learning', url: 'http://neuralnetworksanddeeplearning.com/', note: 'A free book by Michael Nielsen that builds intuition step by step.' }, d2l('Dive into Deep Learning', '', 'A free, interactive textbook with runnable code.')],
  },
  'perceptrons': {
    commonMistakes: [
      { mistake: 'Expecting a single perceptron to solve XOR.', fix: 'It only draws one straight boundary. XOR needs a hidden layer or a feature that makes the data separable.' },
      { mistake: 'Forgetting the bias term.', fix: 'Without a bias, the boundary must pass through the origin, which many problems do not allow.' },
      { mistake: 'Running the perceptron rule on data that is not separable.', fix: 'The classic rule never settles in that case. Use a soft output with a differentiable loss instead.' },
    ],
    furtherReading: [sklearn('Perceptron in scikit-learn', 'modules/linear_model.html#perceptron', 'A practical implementation to experiment with.'), { title: 'Deep Learning, Chapter 6', url: 'https://www.deeplearningbook.org/contents/mlp.html', note: 'Covers why XOR needs hidden layers.' }],
  },
  'activation-functions-and-losses': {
    commonMistakes: [
      { mistake: 'Using sigmoid in all hidden layers of a deep network.', fix: 'Saturation shrinks gradients. Use ReLU or GELU in hidden layers.' },
      { mistake: 'Using MSE for classification.', fix: 'Cross-entropy gives stronger gradients for confident mistakes and matches a probabilistic output.' },
      { mistake: 'Passing probabilities to a loss that expects logits.', fix: 'Read the loss documentation. Applying softmax twice compresses outputs and slows learning.' },
    ],
    furtherReading: [{ title: 'PyTorch loss functions', url: 'https://pytorch.org/docs/stable/nn.html#loss-functions', note: 'Exact inputs each loss expects.' }, d2l('Multilayer perceptrons', 'chapter_multilayer-perceptrons/index.html', 'Activations and losses in working code.')],
  },
  'forward-propagation': {
    commonMistakes: [
      { mistake: 'Ignoring tensor shapes until an error appears.', fix: 'Write the expected shape of each layer as a comment, and print them on the first batch.' },
      { mistake: 'Silent broadcasting between mismatched shapes.', fix: 'A target of shape (n) against predictions of shape (n, 1) can broadcast to (n, n). Check that they match before computing a loss.' },
      { mistake: 'Leaving a model in training mode for inference.', fix: 'Call `model.eval()` and use `torch.no_grad()` so dropout and BatchNorm behave correctly.' },
    ],
    furtherReading: [d2l('Forward and backward propagation', 'chapter_multilayer-perceptrons/backprop.html', 'A computational-graph view of the pass.'), { title: 'torch.nn documentation', url: 'https://pytorch.org/docs/stable/nn.html', note: 'Reference for layers and their expected shapes.' }],
  },
  'backpropagation': {
    commonMistakes: [
      { mistake: 'Believing backward() updates the weights.', fix: 'It only computes gradients. The update happens in `optimizer.step()`.' },
      { mistake: 'Breaking the graph by accident.', fix: 'Calling `.item()`, `.detach()`, or converting to NumPy mid-computation stops gradients from flowing.' },
      { mistake: 'Ignoring exploding or vanishing gradients.', fix: 'Log gradient norms. Use residual connections, normalization, and gradient clipping when needed.' },
    ],
    furtherReading: [{ title: 'Automatic differentiation with torch.autograd', url: 'https://pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html', note: 'The official PyTorch tutorial.' }, { title: 'Neural Networks and Deep Learning, Chapter 2', url: 'http://neuralnetworksanddeeplearning.com/chap2.html', note: 'A careful, intuitive derivation.' }],
  },
  'optimizers': {
    commonMistakes: [
      { mistake: 'Comparing optimizers with one shared learning rate.', fix: 'Each needs its own rate. Run a short sweep for each before comparing.' },
      { mistake: 'Combining L2 with Adam and expecting true weight decay.', fix: 'Use AdamW, which decouples weight decay from the adaptive update.' },
      { mistake: 'Never reducing the learning rate.', fix: 'A schedule, such as cosine decay, often improves the final result.' },
    ],
    furtherReading: [arxiv('Adam: A Method for Stochastic Optimization', '1412.6980', 'The original paper.'), { title: 'torch.optim documentation', url: 'https://pytorch.org/docs/stable/optim.html', note: 'Optimizers and learning-rate schedulers.' }],
  },
  'convolutional-neural-networks': {
    commonMistakes: [
      { mistake: 'Getting the flattened size wrong before a linear layer.', fix: 'Use `nn.AdaptiveAvgPool2d(1)`, so the size no longer depends on the input resolution.' },
      { mistake: 'Training from scratch on a small dataset.', fix: 'Start with a pretrained backbone. See the transfer learning lesson.' },
      { mistake: 'Assuming CNNs handle rotation and scale automatically.', fix: 'Convolution is translation-equivariant only. Use augmentation to teach other kinds of invariance.' },
    ],
    furtherReading: [d2l('Convolutional neural networks', 'chapter_convolutional-neural-networks/index.html', 'Convolution, padding, and pooling with code.'), arxiv('Deep Residual Learning for Image Recognition', '1512.03385', 'The ResNet paper.')],
  },
  'recurrent-neural-networks': {
    commonMistakes: [
      { mistake: 'Confusing `batch_first` shapes.', fix: 'PyTorch RNNs default to (sequence, batch, features). Set `batch_first=True` when your data is arranged that way.' },
      { mistake: 'Skipping gradient clipping.', fix: 'Recurrent gradients can explode. Use `clip_grad_norm_` before the optimizer step.' },
      { mistake: 'Including padding in the loss.', fix: 'Pack sequences or mask padded positions so they do not count.' },
    ],
    furtherReading: [d2l('Long short-term memory', 'chapter_recurrent-modern/lstm.html', 'LSTM gates, with implementations.'), { title: 'Understanding LSTM Networks', url: 'https://colah.github.io/posts/2015-08-Understanding-LSTMs/', note: 'A widely loved visual explanation.' }],
  },
  'attention-mechanism': {
    commonMistakes: [
      { mistake: 'Reading attention weights as a full explanation.', fix: 'They show where the model mixed information, not why it made a decision. Validate any interpretation.' },
      { mistake: 'Forgetting padding masks.', fix: 'Without a mask, tokens attend to padding, which degrades results and can change with batch composition.' },
      { mistake: 'Using the wrong causal mask direction.', fix: 'A token must not see future tokens during training. Test this with a small example.' },
    ],
    furtherReading: [arxiv('Neural Machine Translation by Jointly Learning to Align and Translate', '1409.0473', 'The paper that popularized attention.'), d2l('Attention mechanisms and transformers', 'chapter_attention-mechanisms-and-transformers/index.html', 'From queries and keys to transformers.')],
  },
  'transformers': {
    commonMistakes: [
      { mistake: 'Forgetting positional information.', fix: 'Attention alone ignores order. Add positional embeddings or encodings.' },
      { mistake: 'Training a large transformer from scratch.', fix: 'For most tasks, start from a pretrained model and fine-tune it.' },
      { mistake: 'Skipping learning-rate warmup.', fix: 'Transformers often benefit from warmup, so that early large gradients do not destabilize training.' },
    ],
    furtherReading: [arxiv('Attention Is All You Need', '1706.03762', 'The original transformer paper.'), { title: 'The Illustrated Transformer', url: 'https://jalammar.github.io/illustrated-transformer/', note: 'A popular visual walkthrough.' }],
  },
  'image-data-and-augmentation': {
    commonMistakes: [
      { mistake: 'Mixing up RGB and BGR, or channel order.', fix: 'OpenCV loads BGR, and some tools put channels last. Plot a tensor just before it enters the model.' },
      { mistake: 'Augmenting validation data randomly.', fix: 'Use only deterministic resizing and normalization for evaluation.' },
      { mistake: 'Using augmentations that change the label.', fix: 'Ask whether a person would give the transformed image the same label. For detection, transform the boxes too.' },
    ],
    furtherReading: [d2l('Image augmentation', 'chapter_computer-vision/image-augmentation.html', 'Effects of each augmentation, with code.'), { title: 'torchvision transforms', url: 'https://pytorch.org/vision/stable/transforms.html', note: 'The standard augmentation toolkit in PyTorch.' }],
  },
  'transfer-learning': {
    commonMistakes: [
      { mistake: 'Fine-tuning with a high learning rate.', fix: 'Use something like 1e-5 for pretrained layers and a higher rate for the new head.' },
      { mistake: 'Using the wrong preprocessing for the weights.', fix: 'Apply the resize and normalization the pretrained weights expect; torchvision publishes them with each set of weights.' },
      { mistake: 'Forgetting BatchNorm statistics while frozen.', fix: 'Running statistics still update in training mode, so set frozen BatchNorm layers to `eval()`.' },
    ],
    furtherReading: [{ title: 'Transfer learning for computer vision', url: 'https://pytorch.org/tutorials/beginner/transfer_learning_tutorial.html', note: 'The official PyTorch tutorial.' }, d2l('Fine-tuning', 'chapter_computer-vision/fine-tuning.html', 'A worked example with discriminative learning rates.')],
  },
  'object-detection-and-segmentation': {
    commonMistakes: [
      { mistake: 'Comparing mAP values computed differently.', fix: 'mAP at IoU 0.5 is far easier than COCO’s 0.5:0.95. Always state the definition.' },
      { mistake: 'Flipping images without flipping boxes or masks.', fix: 'Use a library that transforms them together, and draw a few samples to check.' },
      { mistake: 'Running NMS across all classes at once.', fix: 'Run it per class, so that overlapping objects of different classes both survive.' },
    ],
    furtherReading: [arxiv('Faster R-CNN', '1506.01497', 'A foundational two-stage detector.'), arxiv('U-Net', '1505.04597', 'The classic segmentation architecture.'), d2l('Object detection and bounding boxes', 'chapter_computer-vision/bounding-box.html', 'A practical introduction, with code.')],
  },
  'tokenization-and-embeddings': {
    commonMistakes: [
      { mistake: 'Using a tokenizer that does not match the model.', fix: 'Load both from the same checkpoint. A mismatch does not raise an error; results are simply garbage.' },
      { mistake: 'Estimating cost from word counts.', fix: 'Billing and limits use tokens, so count them with the model’s own tokenizer.' },
      { mistake: 'Comparing embeddings from different models.', fix: 'Vectors from different models live in unrelated spaces, so changing models means re-embedding everything.' },
    ],
    furtherReading: [{ title: 'Hugging Face LLM Course: Tokenizers', url: 'https://huggingface.co/learn/llm-course/chapter6/1', note: 'How BPE and other algorithms work, with code.' }, arxiv('Neural Machine Translation of Rare Words with Subword Units', '1508.07909', 'The paper that brought BPE to neural models.'), arxiv('Efficient Estimation of Word Representations', '1301.3781', 'The word2vec paper.')],
  },
  'how-llms-generate-text': {
    commonMistakes: [
      { mistake: 'Treating low temperature as a truth setting.', fix: 'It only makes output more predictable. A confident error stays an error; use sources and evaluations.' },
      { mistake: 'Treating a fluent answer as a correct one.', fix: 'Build an evaluation set for your task, and verify citations and numbers.' },
      { mistake: 'Treating retrieved or user content as trusted.', fix: 'It can contain instructions. Separate it from your instructions and limit what the model can do with it.' },
    ],
    furtherReading: [arxiv('The Curious Case of Neural Text Degeneration', '1904.09751', 'The paper that introduced nucleus (top-p) sampling.'), { title: 'Generation strategies', url: 'https://huggingface.co/docs/transformers/main/en/generation_strategies', note: 'Practical decoding options in Hugging Face Transformers.' }, arxiv('Language Models are Few-Shot Learners', '2005.14165', 'The GPT-3 paper.')],
  },
  'retrieval-augmented-generation': {
    commonMistakes: [
      { mistake: 'Tuning the prompt before checking retrieval.', fix: 'Log retrieved chunks and measure recall@k first. A prompt cannot fix a missing passage.' },
      { mistake: 'Using one fixed chunk size for every document type.', fix: 'Split on structure, and handle tables and code separately.' },
      { mistake: 'Forgetting access control.', fix: 'Filter by user permission during retrieval, so private documents never reach the prompt.' },
    ],
    furtherReading: [arxiv('Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', '2005.11401', 'The original RAG paper.'), { title: 'Ragas documentation', url: 'https://docs.ragas.io/', note: 'Tools for measuring faithfulness and retrieval quality.' }],
  },
  'serving-models': {
    commonMistakes: [
      { mistake: 'Loading pickle files from untrusted sources.', fix: 'Pickle can run arbitrary code on load. Only load artifacts you produced, or use a safer format such as ONNX or safetensors.' },
      { mistake: 'Re-implementing preprocessing in the service.', fix: 'Ship one pipeline with the model, so training and serving cannot drift apart.' },
      { mistake: 'Reporting only average latency.', fix: 'Track p50, p95, and p99 under realistic load.' },
    ],
    furtherReading: [{ title: 'FastAPI documentation', url: 'https://fastapi.tiangolo.com/', note: 'A popular Python framework with built-in validation.' }, { title: 'ONNX Runtime documentation', url: 'https://onnxruntime.ai/docs/', note: 'Portable, optimized model inference.' }, { title: 'Rules of Machine Learning', url: 'https://developers.google.com/machine-learning/guides/rules-of-ml', note: 'Hard-won production lessons.' }],
  },
  'monitoring-and-drift': {
    commonMistakes: [
      { mistake: 'Monitoring only service health.', fix: 'A model can be up and wrong. Add data, prediction, and outcome checks.' },
      { mistake: 'Retraining as the first response to any alert.', fix: 'Diagnose first. Retraining on a broken pipeline teaches the model the bug.' },
      { mistake: 'Alerting on every statistically significant change.', fix: 'Large samples flag trivial differences. Use effect sizes tied to an action.' },
    ],
    furtherReading: [{ title: 'Monitoring Distributed Systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/', note: 'Google’s SRE chapter on what to alert on.' }, { title: 'Rules of Machine Learning', url: 'https://developers.google.com/machine-learning/guides/rules-of-ml', note: 'Includes guidance on monitoring and training-serving skew.' }],
  },
  'responsible-ai': {
    commonMistakes: [
      { mistake: 'Only reporting overall metrics.', fix: 'Break results down by relevant groups, with counts and confidence intervals.' },
      { mistake: 'Assuming that removing a sensitive column removes bias.', fix: 'Audit outcomes by group, and look for proxy features and biased labels.' },
      { mistake: 'Leaving the fairness choice implicit.', fix: 'Write down which criteria you chose, why, who decided, and what the trade-offs are.' },
    ],
    furtherReading: [arxiv('Model Cards for Model Reporting', '1810.03993', 'The paper behind model documentation.'), { title: 'Fairness and Machine Learning', url: 'https://fairmlbook.org/', note: 'A free book on the limits and opportunities of fair ML.' }, { title: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', note: 'A widely used framework for managing AI risk.' }],
  },
}
