'use strict';

// CRUD for the queue. Filtering happens here so the page doesn't keep a
// second copy of the rules.

const express = require('express');
const { loadBugs, saveBugs } = require('../bugStore');
const { shapeBug } = require('../../utils/shapeBug');
const { comparePriority } = require('../../utils/priority');

const SOURCES = ['slack', 'zendesk', 'email', 'manual'];
const STATUSES = ['New', 'Triaged', 'In Progress', 'Resolved'];

const router = express.Router();

function indexById(bugs) {
  const map = new Map();
  for (const bug of bugs) map.set(bug.id, bug);
  return map;
}

function compareIso(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareUpdatedDesc(a, b) {
  const cmp = compareIso(a.updatedAt, b.updatedAt);
  if (cmp === 0) return String(a.id).localeCompare(String(b.id));
  return -cmp;
}

function nextId(bugs) {
  let max = 1000;
  for (const bug of bugs) {
    const match = /^TB-(\d+)$/.exec(bug.id || '');
    if (!match) continue;
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return 'TB-' + (max + 1);
}

function readFields(body, partial) {
  const source = body || {};
  const errors = [];
  const fields = {};

  function has(key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  if (!partial || has('title')) {
    const title = String(source.title || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!title) errors.push('title is required');
    else if (title.length > 180) errors.push('title is too long');
    else fields.title = title;
  }

  if (!partial || has('body')) {
    const text = String(source.body || '').trim();
    if (text.length > 8000) errors.push('body is too long');
    else fields.body = text;
  }

  if (!partial || has('source')) {
    const src = String(source.source || '')
      .trim()
      .toLowerCase();
    if (SOURCES.indexOf(src) === -1) {
      errors.push('source should be slack, zendesk, email, or manual');
    } else fields.source = src;
  }

  if (!partial || has('sourceRef')) {
    fields.sourceRef = String(source.sourceRef || '')
      .trim()
      .slice(0, 160);
  }

  if (!partial || has('priority')) {
    const priority = String(source.priority || '')
      .trim()
      .toUpperCase();
    if (!/^P[0-9]{1,2}$/.test(priority)) errors.push('priority looks off');
    else fields.priority = priority;
  }

  if (!partial || has('area')) {
    const area = String(source.area || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(area)) errors.push('area is required');
    else fields.area = area;
  }

  if (!partial || has('status')) {
    const status = source.status || 'New';
    if (STATUSES.indexOf(status) === -1) errors.push('status is not one we use');
    else fields.status = status;
  }

  if (!partial || has('owner')) {
    const owner = String(source.owner || '')
      .trim()
      .replace(/\s+/g, ' ');
    fields.owner = owner || null;
  }

  if (!partial || has('reporter')) {
    const reporter = String(source.reporter || '')
      .trim()
      .replace(/\s+/g, ' ');
    fields.reporter = reporter || null;
  }

  if (!partial || has('customer')) {
    const customer = String(source.customer || '')
      .trim()
      .replace(/\s+/g, ' ');
    fields.customer = customer || null;
  }

  if (!partial || has('duplicateOf')) {
    const dup = String(source.duplicateOf || '')
      .trim()
      .toUpperCase();
    if (dup && !/^TB-\d+$/.test(dup)) errors.push('duplicate id looks off');
    else fields.duplicateOf = dup || null;
  }

  return { errors: errors, fields: fields };
}

// TODO: reject A -> B -> A. Jordan made a loop in the spreadsheet version
// and we stared at it for twenty minutes. not today.
function duplicateError(fields, bugs, selfId) {
  if (!Object.prototype.hasOwnProperty.call(fields, 'duplicateOf')) return null;
  if (!fields.duplicateOf) return null;
  if (selfId && fields.duplicateOf === selfId) {
    return 'a bug cannot be a duplicate of itself';
  }
  const found = bugs.some((bug) => bug.id === fields.duplicateOf);
  if (!found) return 'duplicate target is not on the board';
  return null;
}

function publicBug(bug, bugs) {
  const shaped = shapeBug(bug, indexById(bugs));
  delete shaped.searchText;
  return shaped;
}

function list(req, res) {
  const all = loadBugs();
  const byId = indexById(all);
  let sort = req.query.sort || 'updated';
  if (sort !== 'priority' && sort !== 'created' && sort !== 'updated') {
    sort = 'updated';
  }
  let dir = req.query.dir;
  if (dir !== 'asc' && dir !== 'desc') {
    dir = sort === 'priority' ? 'asc' : 'desc';
  }

  const filtered = all.filter((bug) => {
    if (req.query.status && bug.status !== req.query.status) return false;
    if (req.query.priority && bug.priority !== req.query.priority) return false;
    if (req.query.area && bug.area !== req.query.area) return false;
    if (req.query.source && bug.source !== req.query.source) return false;
    if (req.query.owner === 'unassigned') {
      if (bug.owner) return false;
    } else if (req.query.owner && bug.owner !== req.query.owner) {
      return false;
    }
    return true;
  });

  let shaped = filtered.map((bug) => shapeBug(bug, byId));

  if (req.query.q) {
    const needle = String(req.query.q).trim().toLowerCase();
    if (needle) {
      shaped = shaped.filter((bug) => bug.searchText.indexOf(needle) !== -1);
    }
  }

  shaped.sort((a, b) => {
    if (sort === 'priority') {
      const cmp = comparePriority(a, b);
      if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      return compareUpdatedDesc(a, b);
    }
    const field = sort === 'created' ? 'createdAt' : 'updatedAt';
    let timeCmp = compareIso(a[field], b[field]);
    if (timeCmp === 0) timeCmp = String(a.id).localeCompare(String(b.id));
    return dir === 'asc' ? timeCmp : -timeCmp;
  });

  shaped.forEach((bug) => {
    delete bug.searchText;
  });

  res.json({ bugs: shaped, count: shaped.length });
}

function getOne(req, res) {
  const bugs = loadBugs();
  const bug = bugs.find((item) => item.id === req.params.id);
  if (!bug) {
    res.status(404).json({ error: 'no bug with that id' });
    return;
  }
  res.json(publicBug(bug, bugs));
}

function create(req, res) {
  const parsed = readFields(req.body, false);
  if (parsed.errors.length) {
    res.status(400).json({ error: parsed.errors[0] });
    return;
  }
  const bugs = loadBugs();
  const dupError = duplicateError(parsed.fields, bugs, null);
  if (dupError) {
    res.status(400).json({ error: dupError });
    return;
  }
  const now = new Date().toISOString();
  const bug = Object.assign({}, parsed.fields, {
    id: nextId(bugs),
    createdAt: now,
    updatedAt: now,
  });
  bugs.push(bug);
  saveBugs(bugs);
  res.status(201).json(publicBug(bug, bugs));
}

function update(req, res) {
  const bugs = loadBugs();
  const index = bugs.findIndex((bug) => bug.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'no bug with that id' });
    return;
  }
  const parsed = readFields(req.body, true);
  if (parsed.errors.length) {
    res.status(400).json({ error: parsed.errors[0] });
    return;
  }
  const dupError = duplicateError(parsed.fields, bugs, bugs[index].id);
  if (dupError) {
    res.status(400).json({ error: dupError });
    return;
  }
  const next = Object.assign({}, bugs[index], parsed.fields, {
    updatedAt: new Date().toISOString(),
  });
  bugs[index] = next;
  saveBugs(bugs);
  res.json(publicBug(next, bugs));
}

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);

module.exports = router;
