# DeepNova

A learning studio for machine learning and AI.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. No credentials or backend are required. The production build is `npm run build`; run the configured ESLint checks with `npm run lint`.

## What is included

- Seventeen authored lessons across ML foundations and a Deep Learning sequence from perceptrons through transformers, with plain-language explanations, worked examples, KaTeX formulas, PyTorch snippets, practice answers, quizzes, takeaways, interview questions, and mini projects.
- Roadmap filters, lesson search (including `Cmd/Ctrl+K`), accessible lesson navigation, expandable practice answers, and code copy.
- Browser-local lesson completion, bookmarks, notes, and activity-based streaks.
- Revision cards sourced from completed or bookmarked lessons.
- Five interactive visual labs: linear regression, gradient descent, overfitting vs. underfitting, KNN decision boundaries, and K-means clustering. Each has responsive controls, parameter explanations, and a reset action.
- Project briefs and interview practice prompts. Dataset licenses, attribution, and execution are not implied by these briefs.
- Light/dark themes and mobile navigation.

## Content model

Lesson data is kept outside the UI in `src/content/lessons.ts`. `Lesson` and `LessonSection` provide the schema for objectives, prerequisites, explanations, formula text, code, practice, quiz feedback, key takeaways, interview answers, and related lessons. `modules` describes the wider roadmap; topics without published lesson data are explicitly marked as planned.

To add a lesson, create a `Lesson` entry and add its slug to the appropriate course module. The reader, search, curriculum, progress, and revision views consume that shared data.

## Persistence and security

This version stores progress in the browser's `localStorage`. It has no authentication, Supabase connection, server-side data store, or remote Python execution. PyTorch snippets are copyable examples, not executed by the app; run them in a separate Python environment with PyTorch installed. `.env.example` documents that no environment variables are needed for this demo. Do not put secrets in frontend environment variables.

## Technology

React 19, TypeScript, Vite, React Router, Tailwind CSS 4 (PostCSS), custom responsive CSS, Recharts, KaTeX, Lucide React, and ESLint.
