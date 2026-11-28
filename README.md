# Clipboard

A small web app for sharing text snippets by link. Sign up, write a clipboard, choose who can see it, and send the URL.

Built for CSE 3206 (Software Engineering Sessional), RUET.

## Features

- **Accounts:** sign up, log in and log out, with cookie sessions (24 hours)
- **Clipboards:** create, edit and delete from a dashboard
- **Visibility:** private, public, or password-protected
- **Expiry:** optional expiry date and time
- **View counter:** counts visitors' views and ignores the owner's
- **Persistent storage:** data is saved to a JSON file (`database.json`)

## Tech stack

Node.js, Express 5, cookie-parser, vanilla HTML/CSS/JS frontend, `node:test` for unit tests, Puppeteer for end-to-end tests.

## Getting started

```bash
npm install
npm start
```

Open <http://localhost:3000>.

## Project structure

```
server.js              Express app and API routes
auth.js                Signup, login and session logic
user.js                User model
clipboard.js           Clipboard logic (ids, ownership, visibility, expiry, views)
hashing.js             Password hashing (scrypt + salt, timing-safe compare)
database-adapter.js    Database interface
fs-database.js         JSON-file implementation of the interface
public/                Frontend pages (landing, auth, dashboard, editor, viewer)
tests/                 Unit tests and a mock database
e2e.js                 End-to-end browser test (Puppeteer)
```

Storage sits behind `database-adapter.js`, so the JSON file can be swapped for another database without touching the app logic.

## API

All routes are under `/api`. Failed requests usually return `200` with `{ "success": false, "error": "..." }`; missing sessions return `401`.

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth?mode=signup` or `login` | no | Body: `{ username, password }` |
| POST | `/logout` | yes | End the session |
| GET | `/list-clipboard` | yes | Your clipboards |
| POST | `/create-clipboard` | yes | Create an empty clipboard, returns its `id` |
| GET | `/edit-clipboard?id=` | owner | Load a clipboard for editing |
| POST | `/save-clipboard?id=` | owner | Body: `{ title, text, visibility, password, expiresAt }` |
| POST | `/delete-clipboard?id=` | owner | Delete a clipboard |
| GET | `/get-clipboard?id=` | no | Public view. Send header `x-clipboard-password` for protected ones |

Visibility values: `0` private, `1` public, `2` password.

## Testing

```bash
npm test                 # unit tests (database is mocked)
npm run test:e2e         # browser tests; starts its own server on port 3000
```

Coverage:

```bash
node --test --experimental-test-coverage
```

The end-to-end test runs the server from a temporary copy of the project, so your `database.json` is never modified. Set `HEADED=1` to watch the browser and `SLOW=150` to slow it down. Stop any server on port 3000 before running it.

## Git workflow

- Branch names: `feature/<name>`, `fix/<name>`, `test/<name>`
- Commit messages: short, imperative (`Add password check to get-clipboard`)
- Changes go in through pull requests with a review

## Notes

`e2e.js` was written with AI assistance and then reviewed by the team.
