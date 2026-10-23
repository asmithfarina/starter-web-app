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

## Scripts

- `npm run dev` — start the server (restarts when server files change)
- `npm start` — start it without the file watcher
- `npm run seed` — overwrite `data/bugs.json` from the seed
- `npm run lint` — eslint
- `npm run format` — prettier (the client hasn't been through it)

## Known issues / next up

- Sorting by priority is alphabetical. A priority of P10 shows up before P2. Choose Priority in the sort menu (or click the Priority column) and "Audit log export times out for orgs past 50k events" sits with the P1s instead of after the P3s.
- The detail panel prints timestamps as stored UTC, so they look an hour or two off from local time.
- There is no login. Anyone who can open the port can edit the board.
- Next: real Slack and Zendesk ingest, pagination once this is more than a couple hundred rows, and rejecting duplicate cycles.
