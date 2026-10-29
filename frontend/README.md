# Frontend

The web app for Ma'at. It is where people read problems, write and submit solutions, and watch the verdict come in.

## What it is built with

- React and Vite
- Plain CSS with a small set of design tokens, in `src/styles/`. There is no UI framework
- Monaco, the editor from VS Code, for writing code. It is served from the app's own bundle, not a CDN
- React Router for navigation
- react-markdown for problem statements
- socket.io-client for live verdicts and standings
- Fonts (Marcellus, Instrument Sans, JetBrains Mono, Noto Sans Egyptian Hieroglyphs) installed from npm and served by the app itself, so visitors' browsers never contact another company

## Pages

| Page | What you can do |
| :--- | :--- |
| Home | See what Ma'at is and how a verdict is reached |
| Login, sign up, forgot and reset password | Create an account or sign in, and reset a forgotten password |
| Problems | Search and filter problems by difficulty |
| Problem | Read the statement on the left, write code on the right in C++17 or Python 3, format it (Alt+Shift+F), run it on the examples, and submit |
| Solutions | Read the accepted solutions people chose to share, once no running contest uses the problem |
| My submissions | See your history, or just one problem's, and open any submission to review it and share or hide it |
| Contests | See upcoming and running contests, a countdown, and live standings |
| Profile | Your progress by difficulty and latest submissions, then your name, profile picture, password and account deletion |
| Admin | Create problems, manage test cases, schedule or start contests, and manage users |
| Privacy policy and terms of use | Plain-language legal pages, linked from the footer and the sign-up form |

## The verdict panel

This is the part you look at after every submission, so it gets the most care. A submission moves from waiting to being weighed to its final result, and each test appears with its verdict and time. Updates arrive over a WebSocket. A slow poll runs alongside it, so a dropped connection never loses a verdict. If the judge itself fails, the panel says so and asks you to submit again.

## Running it

```sh
npm install
npm run dev
```

The dev server starts on http://localhost:5173 with hot reload and proxies `/api`, `/socket.io` and `/health` to the backend on http://localhost:5000. The proxy presents itself to the backend as the site's own origin, so writes are accepted without changing the backend's `FRONTEND_URL`. Set `BACKEND_URL` to point somewhere else.

Other commands:

| Command | What it does |
| :--- | :--- |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built bundle locally |
| `npm test` | Component and helper tests (Vitest) |
| `npm run test:e2e` | Sign up, submit, live verdicts, contests, admin and account deletion in a real browser (Playwright). Needs the full stack running with `docker compose up -d`. Run `npx playwright install chromium` once first |

## Settings

Read at build time. In Docker they are passed as build arguments from the root `.env`.

| Variable | Meaning |
| :--- | :--- |
| `VITE_SITE_URL` | Public address of the site. Used for the canonical link, social preview and structured data. Default `http://localhost:8080` |
| `VITE_CONTACT_EMAIL` | Contact address shown on the privacy policy and terms. Empty shows a generic line |

## Folder layout

```
frontend/
├── index.html           Default title, description and social tags
├── vite.config.js       Dev proxy, site address
├── nginx.conf           Production server: SPA fallback, API and socket proxy
├── public/              Favicon, icons, social image, web manifest, robots.txt, sitemap.xml
└── src/
    ├── main.jsx         App entry point
    ├── App.jsx          Routes (heavy pages load lazily)
    ├── pages/           One component per page. pages/admin/ is the admin area
    ├── components/      Layout, the moving hieroglyph columns, editor, verdict panel
    ├── context/         Who is logged in, and toasts and confirm dialogs
    ├── lib/             API calls, sockets, hooks, verdict labels, formatting
    └── styles/          base.css (tokens, reset) and app.css (everything else)
```

## Notes on how it works

**Sessions.** The login token lives in a cookie set by the backend, so the app never stores it where scripts can read it.

**Live updates.** After a submission is created, the app joins that submission's socket room and listens for verdicts. The server only lets you join rooms for your own submissions. Contest pages join the contest's room and reload the standings when the server says they changed.

**Drafts.** What you type in the editor is saved in the browser for each problem and language. It never leaves your device.

**Search engines.** `index.html` carries the default tags, because social crawlers do not run scripts. Each page then sets its own title, description and canonical link (`components/Seo.jsx`), and private pages are marked `noindex`. `public/robots.txt` and `public/sitemap.xml` are plain files with the site address written in. **Change `http://localhost:8080` in both to your real domain before deploying.** The sitemap lists the fixed public pages (home, problems, contests, privacy, terms), not each individual problem or contest.

**Production build.** The bundle is built in a multi-stage Docker image and served by nginx, which also proxies API and socket traffic to the backend so everything shares one origin.
