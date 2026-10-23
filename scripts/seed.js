#!/usr/bin/env node
'use strict';

// Resets the working board from data/seed-bugs.json.
// Default path matches src/server/bugStore.js. Run it from the repo root.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { saveBugs } = require('../src/server/bugStore');

const seedPath = path.join(__dirname, '..', 'data', 'seed-bugs.json');
const bugs = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

if (!Array.isArray(bugs)) {
  console.error('seed file is not a list');
  process.exit(1);
}

saveBugs(bugs);
console.log('seeded ' + bugs.length + ' bugs');
