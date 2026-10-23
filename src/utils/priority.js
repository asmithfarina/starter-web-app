'use strict';

function comparePriority(a, b) {
  const left = a && a.priority ? a.priority : '';
  const right = b && b.priority ? b.priority : '';
  return String(left).localeCompare(String(right));
}

module.exports = { comparePriority };
