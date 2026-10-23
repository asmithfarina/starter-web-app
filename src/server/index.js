"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const { loadBugs, workingFile } = require("./bugStore");
const { getSummary } = require("./summary");
const bugsRouter = require("./routes/bugs");

const app = express();
const bugCount = loadBugs().length;

// TODO: stick this behind company SSO once IT actually sends a client id.
// until then the board is whoever can reach the port.

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.method !== "GET") {
    console.log(req.method + " " + req.url);
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/summary", (_req, res) => {
  try {
    res.json(getSummary());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "couldn't read the board" });
  }
});

app.use("/api/bugs", bugsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "no such route" });
});

// the page is static files. no vite, on purpose, until this hurts.
app.use(express.static(path.join(__dirname, "..", "client")));

// tried pushing row updates over a websocket so two people didn't have to refresh.
// the socket died every time the laptop slept, and triage is usually one person.
// const { WebSocketServer } = require("ws");
// const wss = new WebSocketServer({ noServer: true });

app.use((err, _req, res, _next) => {
  if (err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: "that body was not json" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "something broke on the server" });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("triage board http://localhost:" + port);
  console.log(bugCount + " bugs in " + workingFile());
});
