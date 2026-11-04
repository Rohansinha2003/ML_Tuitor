# DeepNova

A learning studio for machine learning and AI: 29 lessons across eight modules, interactive labs, guided projects, and interview practice. Guests can learn without an account, and signing in syncs progress across devices.

## Run locally

Requirements: Node.js 22.12+ and npm.

```sh
npm install
cp server/.env.example server/.env   # then fill it in
npm run dev:server                   # API on http://localhost:5001
npm run dev                          # app on http://localhost:5173
```

If `MONGODB_URI` is empty, local development uses a temporary in-memory database that is erased on restart. Keep `VITE_API_BASE_URL` unset: Vite proxies `/api` to the local API, and Vercel serves it from the same origin.

## Commands

| Command | What it does |
| --- | --- |
| `npm run check:env` | Tests `server/.env` against MongoDB, Google, and your SMTP server, and prints what to fix. Read-only. |
| `npm run build` | Typechecks everything, then builds the frontend, the server, and `api/index.js`. |
| `npm run lint` | Runs ESLint. |
| `npm run test:server` | Runs API, integration, and content tests. Integration tests use an in-memory database. |
| `npx tsx server/scripts/check-lessons.ts <python>` | Runs every lesson's code example and compares the output with what the lesson publishes. Needs NumPy, pandas, scikit-learn, and PyTorch. |

## Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), open your OAuth 2.0 web client.
2. Under **Authorized redirect URIs**, add these, each exactly as written:
   - `http://localhost:5001/api/auth/google/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/api/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `server/.env`, and the production values in Vercel.
4. If the consent screen is in **Testing** mode, only listed test users can sign in. Publish it to open sign-in to everyone.
5. Run `npm run check:env`.

Signing in with Google links to an existing account with the same email. If that account's email was never verified, its password and sessions are removed first, because anyone could have registered it.

## Deploy to Vercel

Import the repository with the default settings. `npm run build` regenerates `api/index.js`, which serves `/api`. Set these in Project Settings → Environment Variables:

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | Required. In Atlas → Network Access, allow `0.0.0.0/0`, because Vercel has no fixed IP addresses. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Required, 32+ characters, and different from each other. |
| `CLIENT_ORIGIN` | Your production URL, such as `https://ml-tuitor.vercel.app`, with no trailing slash. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | The callback must be your production URL, not localhost. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Turn on email verification and password reset. |

After deploying, open `/api/health`. It returns `200` with `database: "connected"` when healthy. Otherwise it returns `503` with a `databaseIssue` of `not-configured`, `authentication`, `network`, or `unknown`.

## How it fits together

- **Frontend:** React 19, TypeScript, Vite, and React Router in `src/`. Routes are lazy-loaded.
- **API:** Express 5 and Mongoose in `server/src/`. `server.ts` runs it locally, and `serverless.ts` is the Vercel entry, bundled to `api/index.js`.
- **Content:** Everything lives in `src/content/`, and the API imports the same files, so there is one source of truth. To add a lesson, add its draft and its entry in `lessonExtras.ts`, then add its slug to a module in `lessons.ts`. Numbering and next/previous follow the module order, and `content.test.ts` catches broken references.
- **Accounts:** Short-lived access tokens are held in memory, with rotating refresh tokens in an HttpOnly cookie. A refresh token replayed outside a 30-second grace window revokes its session.
- **Progress:** Guest progress stays in `localStorage` and moves into the account at sign-in. Existing account data wins any conflict.

Lesson code is copyable, not run by the app. Do not put secrets in frontend environment variables.
