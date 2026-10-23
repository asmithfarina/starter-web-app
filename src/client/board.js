"use strict";

// Triage queue. Talks to the express API and renders the table.
// No build step on purpose.

var AREAS = [
  ["billing", "Billing"],
  ["auth", "Auth"],
  ["search", "Search"],
  ["notifications", "Notifications"],
  ["api", "API"],
  ["frontend", "Frontend"],
  ["onboarding", "Onboarding"],
  ["integrations", "Integrations"],
  ["oncall", "On-call"],
];

var SOURCE_LABELS = {
  slack: "Slack",
  zendesk: "Zendesk",
  email: "Email",
  manual: "Manual",
};

var USUAL_PRIORITIES = ["P0", "P1", "P2", "P3"];

var state = {
  bugs: [],
  summary: null,
  catalog: [],
  filters: {
    q: "",
    status: "",
    priority: "",
    area: "",
    source: "",
    owner: "",
    sort: "updated",
  },
  mode: null,
  detail: null,
  me: "",
};

try {
  state.me = localStorage.getItem("triage.me") || "";
} catch {
  // private mode. reporter just starts blank.
}

// TODO: areas are hardcoded. if someone types a new one into the json
// the filter won't offer it. acceptable while the list is this short.

// tried flashing the row you just saved. the id came back, then the
// list re-rendered and the class was gone before anyone saw it.
// function flashRow(id) {
//   var row = document.querySelector('[data-id="' + id + '"]');
//   if (row) row.classList.add("flash");
// }

function areaLabel(slug) {
  for (var i = 0; i < AREAS.length; i++) {
    if (AREAS[i][0] === slug) return AREAS[i][1];
  }
  return slug || "";
}

function priorityClass(priority) {
  if (USUAL_PRIORITIES.indexOf(priority) !== -1) {
    return "pri pri-" + priority.toLowerCase();
  }
  return "pri pri-other";
}

function statusClass(status) {
  if (status === "In Progress") return "status status-progress";
  if (status === "Resolved") return "status status-resolved";
  if (status === "Triaged") return "status status-triaged";
  return "status status-new";
}

function addOption(select, value, label) {
  var opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
  return opt;
}

function queryString() {
  var params = new URLSearchParams();
  var filters = state.filters;
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.area) params.set("area", filters.area);
  if (filters.source) params.set("source", filters.source);
  if (filters.owner) params.set("owner", filters.owner);
  params.set("sort", filters.sort || "updated");
  params.set("dir", filters.sort === "priority" ? "asc" : "desc");
  return params.toString();
}

function showNotice(message) {
  var el = document.getElementById("notice");
  el.hidden = false;
  el.textContent = message;
}

function hideNotice() {
  var el = document.getElementById("notice");
  el.hidden = true;
  el.textContent = "";
}

function showFormError(message) {
  var el = document.getElementById("drawer-error");
  el.hidden = false;
  el.textContent = message;
}

function hideFormError() {
  var el = document.getElementById("drawer-error");
  el.hidden = true;
  el.textContent = "";
}

async function loadList() {
  var res = await fetch("/api/bugs?" + queryString());
  if (!res.ok) throw new Error("list failed");
  var data = await res.json();
  state.bugs = data.bugs || [];
}

async function loadSummary() {
  var res = await fetch("/api/summary");
  if (!res.ok) throw new Error("summary failed");
  state.summary = await res.json();
}

async function ensureCatalog() {
  var res = await fetch("/api/bugs?sort=updated");
  if (!res.ok) throw new Error("catalog failed");
  var data = await res.json();
  state.catalog = data.bugs || [];
}

function fillAreas(select, current, placeholder) {
  select.innerHTML = "";
  if (placeholder) addOption(select, "", placeholder);
  AREAS.forEach(function (pair) {
    addOption(select, pair[0], pair[1]);
  });
  if (current && !AREAS.some(function (pair) { return pair[0] === current; })) {
    addOption(select, current, current);
  }
  select.value = current || "";
}

function fillOwners() {
  var select = document.getElementById("filter-owner");
  var current = state.filters.owner;
  var owners = (state.summary && state.summary.owners) || [];
  select.innerHTML = "";
  addOption(select, "", "All owners");
  addOption(select, "unassigned", "Unassigned");
  owners.forEach(function (name) {
    addOption(select, name, name);
  });
  var list = document.getElementById("owner-list");
  list.innerHTML = "";
  owners.forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  });
  if (current) select.value = current;
}

function fillPriorityFilter() {
  var select = document.getElementById("filter-priority");
  var current = state.filters.priority;
  var counts = (state.summary && state.summary.byPriority) || {};
  var extras = Object.keys(counts).filter(function (key) {
    return USUAL_PRIORITIES.indexOf(key) === -1;
  });
  select.innerHTML = "";
  addOption(select, "", "All priorities");
  USUAL_PRIORITIES.concat(extras).forEach(function (priority) {
    addOption(select, priority, priority);
  });
  if (current) select.value = current;
}

function fillDynamicFilters() {
  fillOwners();
  fillPriorityFilter();
  fillAreas(document.getElementById("filter-area"), state.filters.area, "All areas");
  fillAreas(document.getElementById("f-area"), "", "Pick an area");
}

function renderStats() {
  var el = document.getElementById("stats");
  el.innerHTML = "";
  if (!state.summary) return;
  var open = document.createElement("span");
  open.textContent = state.summary.open + " open";
  el.appendChild(open);
  USUAL_PRIORITIES.forEach(function (priority) {
    var count = state.summary.byPriority[priority] || 0;
    if (!count) return;
    var chip = document.createElement("span");
    chip.className = priorityClass(priority) + " stat-chip";
    chip.textContent = count + " " + priority;
    el.appendChild(chip);
  });
  Object.keys(state.summary.byPriority).forEach(function (priority) {
    if (USUAL_PRIORITIES.indexOf(priority) !== -1) return;
    var chip = document.createElement("span");
    chip.className = priorityClass(priority) + " stat-chip";
    chip.textContent = state.summary.byPriority[priority] + " " + priority;
    el.appendChild(chip);
  });
}

function renderCount() {
  var n = state.bugs.length;
  var sortLabel = "recently updated";
  if (state.filters.sort === "created") sortLabel = "newest";
  if (state.filters.sort === "priority") sortLabel = "priority, P0 first";
  document.getElementById("result-count").textContent =
    n + (n === 1 ? " bug" : " bugs") + " · " + sortLabel;
}

function markSortHeaders() {
  var buttons = document.querySelectorAll("[data-sort]");
  buttons.forEach(function (btn) {
    var on = btn.getAttribute("data-sort") === state.filters.sort;
    btn.classList.toggle("is-active", on);
  });
}

function cell(text, className) {
  var td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text || "";
  return td;
}

function renderRow(bug) {
  var tr = document.createElement("tr");
  tr.dataset.id = bug.id;
  if (bug.status === "Resolved") tr.classList.add("is-resolved");
  if (state.detail && state.detail.id === bug.id) tr.classList.add("is-open");

  tr.appendChild(cell(bug.id, "id-cell"));

  var priTd = document.createElement("td");
  var pill = document.createElement("span");
  pill.className = priorityClass(bug.priority);
  pill.textContent = bug.priority;
  priTd.appendChild(pill);
  tr.appendChild(priTd);

  var titleTd = document.createElement("td");
  titleTd.className = "title-cell";
  var titleBtn = document.createElement("button");
  titleBtn.type = "button";
  titleBtn.className = "title-btn";
  titleBtn.textContent = bug.title;
  if (bug.queueLine) titleBtn.title = bug.queueLine;
  titleTd.appendChild(titleBtn);
  if (bug.duplicateOf) {
    var dup = document.createElement("span");
    dup.className = "dup-tag";
    dup.textContent = "dup of " + bug.duplicateOf;
    titleTd.appendChild(dup);
  }
  if (bug.stale) {
    var stale = document.createElement("span");
    stale.className = "stale-tag";
    stale.textContent = "stale";
    titleTd.appendChild(stale);
  }
  tr.appendChild(titleTd);

  tr.appendChild(cell(areaLabel(bug.area)));
  tr.appendChild(cell(SOURCE_LABELS[bug.source] || bug.source));

  var ownerTd = document.createElement("td");
  if (bug.owner) {
    var wrap = document.createElement("span");
    wrap.className = "owner";
    var initials = document.createElement("span");
    initials.className = "initials";
    initials.textContent = bug.ownerInitials || "";
    wrap.appendChild(initials);
    wrap.appendChild(document.createTextNode(bug.owner));
    ownerTd.appendChild(wrap);
  } else {
    ownerTd.textContent = "Unassigned";
    ownerTd.classList.add("muted");
  }
  tr.appendChild(ownerTd);

  var statusTd = document.createElement("td");
  var status = document.createElement("span");
  status.className = statusClass(bug.status);
  status.textContent = bug.status;
  statusTd.appendChild(status);
  tr.appendChild(statusTd);

  tr.appendChild(cell(bug.idleLabel || "", "muted"));

  tr.addEventListener("click", function () {
    openBug(bug.id);
  });
  return tr;
}

// server returns these already sorted. don't sort again here or the
// columns drift from what the API just sent.
function renderTable() {
  var tbody = document.getElementById("rows");
  tbody.innerHTML = "";
  state.bugs.forEach(function (bug) {
    tbody.appendChild(renderRow(bug));
  });
  document.getElementById("empty").hidden = state.bugs.length !== 0;
}

function render() {
  renderStats();
  renderCount();
  markSortHeaders();
  renderTable();
}

function setSort(sort) {
  state.filters.sort = sort;
  document.getElementById("sort").value = sort;
  refreshList();
}

async function refreshList() {
  hideNotice();
  try {
    await loadList();
    render();
  } catch {
    showNotice("Couldn't load the board.");
  }
}

async function refreshAll() {
  hideNotice();
  try {
    await Promise.all([loadList(), loadSummary()]);
    fillDynamicFilters();
    render();
  } catch {
    showNotice("Couldn't load the board.");
  }
}

function showDrawer() {
  document.getElementById("drawer").hidden = false;
  document.getElementById("backdrop").hidden = false;
}

function closeDrawer() {
  state.mode = null;
  state.detail = null;
  document.getElementById("drawer").hidden = true;
  document.getElementById("backdrop").hidden = true;
  renderTable();
}

function setPriorityField(current) {
  var select = document.getElementById("f-priority");
  select.innerHTML = "";
  USUAL_PRIORITIES.forEach(function (priority) {
    addOption(select, priority, priority);
  });
  if (current && USUAL_PRIORITIES.indexOf(current) === -1) {
    addOption(select, current, current);
  }
  select.value = current || "P2";
}

function fillDuplicates(currentId, selected) {
  var select = document.getElementById("f-dup");
  select.innerHTML = "";
  addOption(select, "", "Not a duplicate");
  state.catalog.forEach(function (bug) {
    if (bug.id === currentId) return;
    addOption(select, bug.id, bug.id + " - " + bug.title);
  });
  if (selected && !state.catalog.some(function (bug) { return bug.id === selected; })) {
    addOption(select, selected, selected + " (missing)");
  }
  select.value = selected || "";
}

function fillForm(bug) {
  var isNew = state.mode === "create";
  document.getElementById("drawer-heading").textContent = isNew ? "New bug" : bug.id;
  document.getElementById("f-title").value = bug.title || "";
  document.getElementById("f-body").value = bug.body || "";
  document.getElementById("f-source").value = bug.source || "manual";
  document.getElementById("f-ref").value = bug.sourceRef || "";
  document.getElementById("f-status").value = bug.status || "New";
  document.getElementById("f-owner").value = bug.owner || "";
  document.getElementById("f-reporter").value = bug.reporter || "";
  document.getElementById("f-customer").value = bug.customer || "";
  setPriorityField(bug.priority || "P2");
  fillAreas(document.getElementById("f-area"), bug.area || "", "Pick an area");
  fillDuplicates(isNew ? null : bug.id, bug.duplicateOf || "");

  var derived = document.getElementById("derived");
  derived.hidden = isNew;
  if (!isNew) {
    document.getElementById("f-summary").textContent = bug.summary || "";
    document.getElementById("f-next").textContent = bug.nextStep || "";
    document.getElementById("f-slack").textContent = bug.slackPaste || "";
    // FIXME: printing the stored UTC string. Dublin reads this as an hour off
    // in the winter and two in the summer. The "xh ago" in the table is the
    // one people actually look at.
    document.getElementById("f-times").textContent =
      "Created " + bug.createdAt + " · updated " + bug.updatedAt;
  }
}

function readForm() {
  return {
    title: document.getElementById("f-title").value,
    body: document.getElementById("f-body").value,
    source: document.getElementById("f-source").value,
    sourceRef: document.getElementById("f-ref").value,
    priority: document.getElementById("f-priority").value,
    area: document.getElementById("f-area").value,
    status: document.getElementById("f-status").value,
    owner: document.getElementById("f-owner").value,
    reporter: document.getElementById("f-reporter").value,
    customer: document.getElementById("f-customer").value,
    duplicateOf: document.getElementById("f-dup").value,
  };
}

async function openBug(id) {
  hideFormError();
  try {
    var res = await fetch("/api/bugs/" + encodeURIComponent(id));
    if (!res.ok) throw new Error("missing");
    state.detail = await res.json();
    state.mode = "edit";
    await ensureCatalog();
    fillForm(state.detail);
    showDrawer();
    renderTable();
  } catch {
    showNotice("Couldn't open that bug.");
  }
}

async function openNew() {
  state.mode = "create";
  state.detail = null;
  hideFormError();
  try {
    await ensureCatalog();
  } catch {
    showNotice("Couldn't load the list for duplicate linking.");
  }
  fillForm({
    title: "",
    body: "",
    source: "manual",
    sourceRef: "",
    priority: "P2",
    area: "",
    status: "New",
    owner: "",
    reporter: state.me,
    customer: "",
    duplicateOf: "",
  });
  showDrawer();
  renderTable();
  document.getElementById("f-title").focus();
}

async function onSave(event) {
  event.preventDefault();
  hideFormError();
  var payload = readForm();
  if (!payload.area) {
    showFormError("Pick an area");
    return;
  }
  if (payload.reporter) {
    state.me = payload.reporter.trim();
    try {
      localStorage.setItem("triage.me", state.me);
    } catch {
      // ignore quota / private mode
    }
  }
  var saveBtn = document.getElementById("save-bug");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    var res;
    if (state.mode === "create") {
      res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/bugs/" + encodeURIComponent(state.detail.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      showFormError(data.error || "Couldn't save");
      return;
    }
    state.detail = data;
    state.mode = "edit";
    await refreshAll();
    await ensureCatalog();
    fillForm(state.detail);
    showDrawer();
    renderTable();
  } catch {
    showFormError("Couldn't save");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

function clearFilters() {
  state.filters.q = "";
  state.filters.status = "";
  state.filters.priority = "";
  state.filters.area = "";
  state.filters.source = "";
  state.filters.owner = "";
  document.getElementById("q").value = "";
  document.getElementById("filter-status").value = "";
  document.getElementById("filter-priority").value = "";
  document.getElementById("filter-area").value = "";
  document.getElementById("filter-source").value = "";
  document.getElementById("filter-owner").value = "";
  refreshList();
}

function bind() {
  document.getElementById("new-bug").addEventListener("click", openNew);
  document.getElementById("close-drawer").addEventListener("click", closeDrawer);
  document.getElementById("cancel-bug").addEventListener("click", closeDrawer);
  document.getElementById("backdrop").addEventListener("click", closeDrawer);
  document.getElementById("bug-form").addEventListener("submit", onSave);
  document.getElementById("clear-filters").addEventListener("click", clearFilters);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeDrawer();
  });

  var searchTimer = null;
  document.getElementById("q").addEventListener("input", function (event) {
    var value = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.filters.q = value.trim();
      refreshList();
    }, 200);
  });

  ["status", "priority", "area", "source", "owner"].forEach(function (key) {
    document.getElementById("filter-" + key).addEventListener("change", function (event) {
      state.filters[key] = event.target.value;
      refreshList();
    });
  });

  document.getElementById("sort").addEventListener("change", function (event) {
    setSort(event.target.value);
  });

  document.querySelectorAll("[data-sort]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSort(btn.getAttribute("data-sort"));
    });
  });
}

fillDynamicFilters();
bind();
refreshAll();
