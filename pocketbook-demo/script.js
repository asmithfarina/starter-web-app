// Sample figures from the Pocketbook mock.
// The headline spent total is the $1,842 printed on the design. The category
// rows are the visible breakdown and do not sum to that headline. Saving an
// expense adds the amount to the chosen category and to the headline total.
const MONTH_LABEL = "November";
const MONTHLY_BUDGET = 2500;
const categories = [
  { name: "Groceries", spent: 412, limit: 600 },
  { name: "Dining out", spent: 318, limit: 250 },
  { name: "Transport", spent: 146, limit: 300 },
  { name: "Utilities", spent: 210, limit: 350 },
  { name: "Fun", spent: 96, limit: 200 },
];

let spentThisMonth = 1842;
// Notes are kept with each save. The mock has no transaction list, so this
// stays in memory and is not rendered.
const expenses = [];

const spentValue = document.getElementById("spent-value");
const leftValue = document.getElementById("left-value");
const overValue = document.getElementById("over-value");
const budgetChip = document.getElementById("budget-chip");
const statusChip = document.getElementById("status-chip");
const overChip = document.getElementById("over-chip");
const categoryList = document.getElementById("categories");
const form = document.getElementById("expense-form");
const amountInput = document.getElementById("amount");
const categorySelect = document.getElementById("category");
const noteInput = document.getElementById("note");
const amountError = document.getElementById("amount-error");
const categoryError = document.getElementById("category-error");
const formNote = document.getElementById("form-note");
const focusButton = document.getElementById("focus-form");

const rows = new Map();
let noteTimer = 0;

document.getElementById("page-title").textContent = `${MONTH_LABEL} budget`;

categories.forEach((category, index) => {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = category.name;
  categorySelect.appendChild(option);

  const row = document.createElement("div");
  row.className = "category";

  const head = document.createElement("div");
  head.className = "category-head";

  const name = document.createElement("span");
  name.className = "category-name";
  name.textContent = category.name;

  const amount = document.createElement("span");
  amount.className = "category-amount";

  head.append(name, amount);

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "meter");
  bar.setAttribute("aria-label", category.name);
  bar.setAttribute("aria-valuemin", "0");

  const fill = document.createElement("div");
  fill.className = "bar-fill";
  bar.appendChild(fill);
  row.append(head, bar);
  categoryList.appendChild(row);
  rows.set(index, { amount, bar, fill });
});

function formatMoney(value) {
  const negative = value < 0;
  const absolute = Math.abs(value);
  const cents = Math.round(absolute * 100) % 100;
  const formatted = absolute.toLocaleString("en-US", {
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}$${formatted}`;
}

function render() {
  const left = Math.round((MONTHLY_BUDGET - spentThisMonth) * 100) / 100;
  const over = categories.filter((category) => category.spent > category.limit);

  spentValue.textContent = formatMoney(spentThisMonth);
  leftValue.textContent = formatMoney(left);
  leftValue.classList.toggle("is-negative", left < 0);
  overValue.textContent = String(over.length);
  budgetChip.textContent = `of ${formatMoney(MONTHLY_BUDGET)} budget`;

  statusChip.textContent = left < 0 ? "Over budget" : "On track";
  statusChip.classList.toggle("chip-good", left >= 0);
  statusChip.classList.toggle("chip-bad", left < 0);
  statusChip.classList.toggle("chip-muted", false);

  if (over.length === 0) {
    overChip.textContent = "None";
    overChip.classList.remove("chip-bad");
    overChip.classList.add("chip-muted");
  } else {
    overChip.textContent = over.map((category) => category.name).join(", ");
    overChip.classList.add("chip-bad");
    overChip.classList.remove("chip-muted");
  }

  categories.forEach((category, index) => {
    const row = rows.get(index);
    const ratio = category.limit > 0 ? category.spent / category.limit : 1;
    const width = Math.max(0, Math.min(ratio, 1)) * 100;
    const isOver = category.spent > category.limit;

    row.amount.textContent = `${formatMoney(category.spent)} / ${formatMoney(category.limit)}`;
    row.fill.style.width = `${width}%`;
    row.fill.classList.toggle("is-over", isOver);
    row.bar.setAttribute("aria-valuemax", String(category.limit));
    row.bar.setAttribute("aria-valuenow", String(category.spent));
    row.bar.setAttribute(
      "aria-valuetext",
      `${formatMoney(category.spent)} of ${formatMoney(category.limit)}${isOver ? ", over limit" : ""}`
    );
  });
}

function setFieldError(input, messageEl, message) {
  if (!message) {
    messageEl.hidden = true;
    messageEl.textContent = "";
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    return;
  }
  messageEl.hidden = false;
  messageEl.textContent = message;
  input.classList.add("is-invalid");
  input.setAttribute("aria-invalid", "true");
}

function parseAmount(raw) {
  const cleaned = String(raw).trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned) * 100) / 100;
  if (!Number.isFinite(value) || value <= 0 || value > 1000000) return null;
  return value;
}

function showSaved(message) {
  formNote.textContent = message;
  formNote.classList.add("is-saved");
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    formNote.textContent = "All figures are fictional.";
    formNote.classList.remove("is-saved");
  }, 3200);
}

focusButton.addEventListener("click", () => {
  amountInput.focus();
  amountInput.select();
});

categorySelect.addEventListener("change", () => {
  categorySelect.classList.toggle("is-placeholder", categorySelect.value === "");
  if (categorySelect.value !== "") {
    setFieldError(categorySelect, categoryError, "");
  }
});

amountInput.addEventListener("input", () => {
  if (amountInput.classList.contains("is-invalid") && parseAmount(amountInput.value)) {
    setFieldError(amountInput, amountError, "");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseAmount(amountInput.value);
  const selected = categorySelect.value;
  const category = selected === "" ? null : categories[Number(selected)];
  let invalid = false;

  if (amount == null) {
    setFieldError(amountInput, amountError, "Enter an amount greater than zero.");
    invalid = true;
  } else {
    setFieldError(amountInput, amountError, "");
  }

  if (!category) {
    setFieldError(categorySelect, categoryError, "Choose a category.");
    invalid = true;
  } else {
    setFieldError(categorySelect, categoryError, "");
  }

  if (invalid) {
    (amount == null ? amountInput : categorySelect).focus();
    return;
  }

  category.spent = Math.round((category.spent + amount) * 100) / 100;
  spentThisMonth = Math.round((spentThisMonth + amount) * 100) / 100;
  expenses.push({
    amount,
    category: category.name,
    note: noteInput.value.trim(),
  });

  render();
  form.reset();
  categorySelect.classList.add("is-placeholder");
  showSaved(`Added ${formatMoney(amount)} to ${category.name}.`);
  amountInput.focus();
});

render();
requestAnimationFrame(() => {
  categoryList.classList.add("is-ready");
});
