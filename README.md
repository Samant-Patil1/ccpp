# 💬 ccpp — S & I's Chat

A WhatsApp-style 1:1 chat web app for exactly two users, **S** and **I**.
Static, no build step, hosted free on GitHub Pages — and it works entirely
without any backend.

**Users:** `S` and `I` · **Password:** `SI96305` (shared by both)

## Features

- **WhatsApp-like conversation** — sidebar with both contacts, message bubbles,
  date separators, message previews, sounds, and a connection indicator.
- **Multiline messages** — the composer grows as you type. `Enter` sends,
  `Shift+ + Enter` inserts a new line.
- **Visible while you type** — whatever you have typed is visible in the
  composer as you type it (that's simply how a text field behaves). No
  "live typing" preview is shown to the other person.
- **Built-in emoji picker** — ~1,000 emojis in 8 categories, inserted at the
  cursor. No external services.
- **Attachments** — photos render inline (auto-compressed to 1600px) and open
  in a lightbox; other files send as download cards (up to ~1 MB).
- **Replies** — hover ↩ (desktop) or swipe right (mobile) on any message to
  reply; the quoted block shows what you're replying to and can be tapped to
  jump to the original message.
- **Responsive** — usable on phones as well as desktops.

## Storage

Messages are kept in the browser's **localStorage**. After every message the
whole store is re-serialised to **JSON** — including the timestamp, the
sender and the content — and written back under one key, so the browser always
holds a complete history:

```
si.messages = '[{"id":"…","ts":1760000000000,"from":"S","type":"text","text":"hi"}, …]'
```

Two browser tabs can chat at the same time — each tab keeps its own signed-in
user and its own session, while both tabs share the same message store.

> Why not a JSON file edited on the server? GitHub Pages only *serves* files —
> browsers cannot write back to the host. Nothing would ever persist, so
> localStorage is the only storage that works on a static site.

## Setup

### 1. Enable GitHub Pages

1. Repo → **Settings → Pages**.
2. **Source**: Deploy from a branch → **Branch: `main`** → **Folder: `/ (root)`** → **Save**.
3. Wait about a minute; the site goes live at
   `https://<your-username>.github.io/ccpp/`.

### 2. Log in and chat

Open the URL (or serve it locally — see below), sign in as `S` or `I` with
the password `SI96305`, and chat away. Open the same URL in a second tab or
browser window to chat with the other user.

## Running locally

```bash
npm run serve     # http://localhost:8080 (static server)
npm test          # unit tests for the logic modules (Node's built-in runner)
```

No dependencies need installing — tests use Node's built-in runner.

## How it works

- `index.html` + `css/style.css` + ES modules in `js/` — no build step, so it
  deploys unchanged to GitHub Pages.
- `js/app.js` bootstraps the UI, manages the per-tab login session and wires
  the composer and message list.
- `js/chat.js` renders incoming/outgoing messages, day separators, replies and
  the "scroll to latest" button.
- `js/composer.js` handles the input (multiline, `Enter` to send), the emoji
  picker and file attachments.
- `js/db/local-backend.js` persists messages as a JSON array in localStorage
  and notifies every open tab about changes.
- All user text is rendered with `textContent` — no HTML injection is possible.

## Security note

This is a personal chat, not a vault. The password lives in the code, and the
storage is local to each browser. It keeps strangers out only because they
don't know the URL and password — don't reuse `SI96305` anywhere else.
