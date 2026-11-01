# DeepNova

A learning studio for machine learning and AI.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The frontend works in guest mode without credentials. For authentication and MongoDB persistence, copy `server/.env.example` to `server/.env`, fill in the Atlas URI and JWT secrets, then run `npm run dev:server` in a second terminal. The production build is `npm run build`; run the configured ESLint checks with `npm run lint` and the API checks with `npm run test:server`.

The frontend uses `/api` by default. Vite proxies that path to `http://localhost:5001` during local development, and Vercel routes it to the bundled Express function in `api/index.js`. Set `VITE_API_BASE_URL` only when the API is hosted separately.

## What is included

- Seventeen authored lessons across ML foundations and a Deep Learning sequence from perceptrons through transformers, with plain-language explanations, worked examples, KaTeX formulas, PyTorch snippets, practice answers, quizzes, takeaways, interview questions, and mini projects.
- Roadmap filters, lesson search (including `Cmd/Ctrl+K`), accessible lesson navigation, expandable practice answers, and code copy.
- Browser-local lesson completion, bookmarks, notes, and activity-based streaks.
- Revision cards sourced from completed or bookmarked lessons.
- Five interactive visual labs: linear regression, gradient descent, overfitting vs. underfitting, KNN decision boundaries, and K-means clustering. Each has responsive controls, parameter explanations, and a reset action.
- Project briefs and interview practice prompts. Dataset licenses, attribution, and execution are not implied by these briefs.
- Light/dark themes and mobile navigation.
- Email/password authentication with rotating HttpOnly refresh cookies, MongoDB-backed progress, bookmarks, notes, and quiz attempts when the API is configured.
- Google OAuth sign-in/sign-up through `/api/auth/google` when Google Cloud credentials are configured.

## Content model

Lesson data is kept outside the UI in `src/content/lessons.ts`. `Lesson` and `LessonSection` provide the schema for objectives, prerequisites, explanations, formula text, code, practice, quiz feedback, key takeaways, interview answers, and related lessons. `modules` describes the wider roadmap; topics without published lesson data are explicitly marked as planned.

To add a lesson, create a `Lesson` entry and add its slug to the appropriate course module. The reader, search, curriculum, progress, and revision views consume that shared data.

## Persistence and security

This version stores progress in the browser's `localStorage`. It has no authentication, Supabase connection, server-side data store, or remote Python execution. PyTorch snippets are copyable examples, not executed by the app; run them in a separate Python environment with PyTorch installed. `.env.example` documents that no environment variables are needed for this demo. Do not put secrets in frontend environment variables.

When signed in, progress is owned by the authenticated MongoDB user and is loaded through the Express API. Guest progress remains local. Password reset and email verification require `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` to be configured. For Google OAuth, create a Google OAuth web client and add `http://localhost:5001/api/auth/google/callback` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `server/.env`. Use the HTTPS callback URL in production.

## Vercel deployment

Import the repository into Vercel with the default root directory and build command (`npm run build`). Configure the server environment variables from `server/.env.example` in the Vercel project settings, including a persistent `MONGODB_URI`, strong JWT secrets, and SMTP settings if password reset/email verification should be enabled. Keep `VITE_API_BASE_URL` unset so browser requests remain same-origin. If Google sign-in is enabled, use the deployed HTTPS callback URL for `GOOGLE_CALLBACK_URL`.

## Technology

React 19, TypeScript, Vite, React Router, Tailwind CSS 4 (PostCSS), custom responsive CSS, Recharts, KaTeX, Lucide React, and ESLint.
