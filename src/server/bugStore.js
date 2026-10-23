'use strict';

const fs = require('fs');
const path = require('path');

function workingFile() {
  if (process.env.DATA_FILE && String(process.env.DATA_FILE).trim()) {
    return path.resolve(process.env.DATA_FILE);
  }
  return path.join(__dirname, '..', '..', 'data', 'bugs.json');
}

function seedFile() {
  return path.join(__dirname, '..', '..', 'data', 'seed-bugs.json');
}

function ensureFile() {
  const file = workingFile();
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(seedFile(), file);
  return file;
}

function loadBugs() {
  const file = ensureFile();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('bug file is not a list');
  }
  return parsed;
}

// TODO: two people hitting save at once will clobber each other. fine while
// it's just whoever is on triage. don't bolt on a lock unless it actually happens.
function saveBugs(bugs) {
  const file = workingFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(bugs, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

module.exports = {
  loadBugs,
  saveBugs,
  workingFile,
};
