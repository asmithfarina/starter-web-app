# Agent notes

Cursor loads `.cursor/rules/`. Claude Code and anything else that reads this file should follow the same notes. Copilot in VS Code picks up `.vscode/` for eslint and prettier, and it does not read this file.

If you change a convention, update this file and the matching `.mdc`. They are supposed to match. They have drifted before.

## Bug fixes

- Cite the bug title (the words on the card, not only `TB-1234`) in the commit and the PR.
- Reproduce it before changing code. One bug per change. Don't reformat the client in the same commit.
- Never auto-run destructive commands: `git reset --hard`, `git push --force`, `git clean -fd`, `rm -rf`, `npm run seed`. Seeding overwrites `data/bugs.json`.

## Style

- Match the file you're in. Two-space indent, semicolons, `const` / `let`.
- Prettier is configured for single quotes (`.prettierrc`). Server code mostly follows it. `src/client/board.js` still uses double quotes. Leave it unless the task is to format the client.
- Don't add a framework, a second data store, or auth in a drive-by.

## Tests

- `node:test` in `test/`. Run `npm test`. CI runs that after `npm run lint`.
- Don't use the shared `data/bugs.json` from a test. Point `DATA_FILE` at a temp file, or read the seed.
- The HTTP routes aren't covered. Add a case beside the behavior you touch.

## Board

- List responses stay `{ bugs, count }`. A single bug is the object itself, no wrapper.
- Priorities stay whatever is already on the bug. Don't invent a second scale.
- Working copy is `data/bugs.json`. The seed is `data/seed-bugs.json`.

## When a claim was wrong

If the user says "hallucination", "that's wrong", or "feedback": pause, name the specific claim, acknowledge it, and offer to log it. If they agree, append an entry to `docs/hallucinations-feedback.md` with the date, what was claimed, why it was wrong, the correct info if they gave it, and the file or context. Don't edit past entries.

## Cursor Cloud specific instructions

The board is a single Node process. No database, Docker, or other services. Run these commands from the repo root (the directory that contains `package.json`).

- Node 22 is already on `PATH` in the cloud VM (CI also uses 22). `./scripts/setup-dev.sh` only requires Node 18+. Do not add `nvm use`. The script skips nvm on purpose, because some agent environments do not have it.
- From the repo root, `./scripts/setup-dev.sh` copies `.env.example` to `.env` when `.env` is missing, then runs `npm install` and `npm run lint`. It does not run the tests. Run `npm test` after it. `npm install` prints deprecation warnings for ESLint 8 and a few transitive packages. The install still exits cleanly with 0 vulnerabilities. Leave ESLint 8; that is what CI runs.
- `npm run dev` (file watcher) or `npm start` listens on `0.0.0.0` and `PORT` from `.env` (3000). It is ready when the log says `triage board http://localhost:3000`. Open that URL. `GET /api/health` returns `{ "ok": true }`. The first start copies `data/seed-bugs.json` to `data/bugs.json` (gitignored, 15 seed bugs). Do not run `npm run seed` unless someone asked to reset the queue; it overwrites the working copy.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, and `npm test`. Do not run `npm run format` unless the task is to format the client. `src/client/board.js` still uses double quotes, so Prettier rewrites the whole file.
