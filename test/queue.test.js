'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { shapeBug } = require('../src/utils/shapeBug');
const { comparePriority } = require('../src/utils/priority');
const store = require('../src/server/bugStore');

const STATUSES = ['New', 'Triaged', 'In Progress', 'Resolved'];

test('seed file is the queue we triage from', () => {
  const file = path.join(__dirname, '..', 'data', 'seed-bugs.json');
  const bugs = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(bugs.length, 15);
  for (const bug of bugs) {
    assert.match(bug.id, /^TB-\d+$/);
    assert.ok(bug.title);
    assert.ok(bug.priority);
    assert.ok(STATUSES.includes(bug.status));
  }
  const copy = bugs.find((bug) => bug.id === 'TB-1828');
  assert.equal(copy.duplicateOf, 'TB-1877');
});

test('shapeBug copies the original title onto a duplicate', () => {
  const now = new Date().toISOString();
  const original = {
    id: 'TB-1877',
    title: 'Search still returns docs the customer deleted',
    body: 'index never got a tombstone',
    source: 'slack',
    sourceRef: '#search-bugs',
    priority: 'P1',
    area: 'search',
    owner: 'Priya Shah',
    status: 'Triaged',
    duplicateOf: null,
    reporter: 'priya',
    customer: 'Northwind Schools',
    createdAt: now,
    updatedAt: now,
  };
  const copy = Object.assign({}, original, {
    id: 'TB-1828',
    title: 'Deleted page still shows up in workspace search',
    status: 'New',
    duplicateOf: 'TB-1877',
    owner: 'Jordan Lee',
  });
  const byId = new Map([
    [original.id, original],
    [copy.id, copy],
  ]);
  const shaped = shapeBug(copy, byId);
  assert.equal(shaped.duplicateOf, 'TB-1877');
  assert.equal(shaped.duplicateTitle, original.title);
  assert.match(shaped.summary, /TB-1877/);
  assert.match(shaped.nextStep, /TB-1877/);
  assert.equal(shaped.ownerInitials, 'JL');
});

test('P0 through P3 stay in that order', () => {
  const rows = ['P2', 'P0', 'P3', 'P1'].map((priority) => ({ priority }));
  rows.sort(comparePriority);
  assert.deepEqual(
    rows.map((row) => row.priority),
    ['P0', 'P1', 'P2', 'P3'],
  );
});

test('the json store roundtrips DATA_FILE', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-'));
  const file = path.join(dir, 'bugs.json');
  const previous = process.env.DATA_FILE;
  process.env.DATA_FILE = file;
  try {
    store.saveBugs([{ id: 'TB-1', title: 'temp' }]);
    const loaded = store.loadBugs();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, 'TB-1');
    assert.equal(loaded[0].title, 'temp');
  } finally {
    if (previous === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
