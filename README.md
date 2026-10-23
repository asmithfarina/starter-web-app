# Triage Board

Internal queue for bugs that show up in Slack and Zendesk. We stick a priority, a product area, and an owner on them before the thread scrolls away.

Each bug has a source (Slack, Zendesk, email, or typed in by hand), a priority, an area, an owner, and a status: New, Triaged, In Progress, or Resolved. You can mark one bug as a duplicate of another.

It's a side project for Northstar triage. Not the system of record.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

The first run copies `data/seed-bugs.json` to `data/bugs.json` and edits that file. `npm run seed` resets the working copy from the seed. Copy `.env.example` to `.env` if you want another port.

On a new laptop, `./scripts/setup-dev.sh` checks Node (18+), copies `.env.example` if you don't already have a `.env`, installs, and runs eslint. It does not run the tests. CI does (`npm test` after lint, `.github/workflows/ci.yml`).

EditorConfig and `.vscode/` are the shared lint and format setup: ESLint plus Prettier, format on save. The client still hasn't been through Prettier, so the first save in `src/client/board.js` is noisy.

## Assistants

People on this repo use Cursor, Copilot, and Claude Code on the same branch. Cursor reads `.cursor/rules/`. Claude Code (and anything else that looks for it) reads `AGENTS.md`. Those two are supposed to say the same thing. Copilot in VS Code follows `.vscode/` for eslint and prettier, and it does not read `AGENTS.md`. If you change a convention, update the rule and `AGENTS.md` or they drift.

## Scripts

- `npm run dev` — start the server (restarts when server files change)
- `npm start` — start it without the file watcher
- `npm run seed` — overwrite `data/bugs.json` from the seed
- `npm run lint` — eslint
- `npm test` — smoke tests (`node:test`)
- `npm run format` — prettier (the client hasn't been through it)

## Known issues / next up

- Sorting by priority is alphabetical. A priority of P10 shows up before P2. Choose Priority in the sort menu (or click the Priority column) and "Audit log export times out for orgs past 50k events" sits with the P1s instead of after the P3s.
- The detail panel prints timestamps as stored UTC, so they look an hour or two off from local time.
- There is no login. Anyone who can open the port can edit the board.
- `.cursor/rules/` and `AGENTS.md` are easy to update in only one place. Copilot still has no instructions file of its own.
- Next: real Slack and Zendesk ingest, pagination once this is more than a couple hundred rows, and rejecting duplicate cycles.
