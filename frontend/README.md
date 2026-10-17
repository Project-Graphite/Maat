# Frontend

The web app for Ma'at. It is where people read problems, write and submit solutions, and watch the verdict come in.

## What it is built with

- React and Vite
- Tailwind for styling
- Monaco, the editor from VS Code, for writing code
- React Router for navigation
- react-markdown for problem statements
- socket.io-client for live verdicts and standings

## Pages

| Page | What you can do |
| :--- | :--- |
| Login and register | Create an account or sign in, and reset a forgotten password |
| Problems | Browse problems with their difficulty and whether you have solved them |
| Problem | Read the statement on the left, write code on the right, pick C++17 or Python 3 and submit |
| My submissions | See your history and open any submission to review its code and verdict |
| Contests | See upcoming and running contests, a countdown, and live standings |
| Profile | Change your details and upload a profile picture |
| Admin | Create problems, upload test cases and set up contests |

## The verdict panel

This is the part you look at after every submission, so it gets the most care. A submission moves from Pending to Running to its final result, and each test case appears as it finishes, colored by outcome. Updates arrive over a WebSocket. If the connection drops, the app quietly falls back to polling the API, so a verdict is never lost.

## Running it

```sh
npm install
npm run dev
```

The dev server starts on http://localhost:5173 with hot reload. The backend needs to be running too, and its `FRONTEND_URL` must match the address you see here, otherwise it will reject requests that change data.

Other commands:

| Command | What it does |
| :--- | :--- |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built bundle locally |

## Folder layout

```
frontend/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx     App entry point
    ├── App.jsx      Root component and routes
    ├── pages/       One component per page
    ├── components/  Shared UI such as the editor and the verdict panel
    ├── hooks/       Data and socket hooks
    └── api/         Functions that call the backend
```

## Notes on how it works

**Sessions.** The login token lives in a cookie set by the backend, so the app never stores it where scripts can read it.

**Live updates.** After a submission is created, the app joins that submission's socket room and listens for verdicts. The server only lets you join rooms for your own submissions.

**Production build.** The bundle is built in a multi-stage Docker image and served by nginx, which also proxies API and socket traffic to the backend so everything shares one origin.
