"use strict";

const { loadBugs } = require("./bugStore");

const STATUSES = ["New", "Triaged", "In Progress", "Resolved"];

function getSummary() {
  const bugs = loadBugs();
  const byStatus = {};
  STATUSES.forEach((status) => {
    byStatus[status] = 0;
  });
  const byPriority = {};
  const owners = {};
  const areas = {};
  let open = 0;

  bugs.forEach((bug) => {
    byStatus[bug.status] = (byStatus[bug.status] || 0) + 1;
    byPriority[bug.priority] = (byPriority[bug.priority] || 0) + 1;
    if (bug.owner) owners[bug.owner] = true;
    if (bug.area) areas[bug.area] = true;
    if (bug.status !== "Resolved") open += 1;
  });

  return {
    total: bugs.length,
    open: open,
    byStatus: byStatus,
    byPriority: byPriority,
    owners: Object.keys(owners).sort(),
    areas: Object.keys(areas).sort(),
  };
}

module.exports = { getSummary };
