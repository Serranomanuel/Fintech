import { getState } from "../state.js";
import {
  formatCurrency,
  currentMonthPrefix,
  calculateTopCategories,
} from "../utils.js";

function renderInsights(txns) {
  const container = document.querySelector("#insights-bars");
  const cats = calculateTopCategories(txns);
  if (!cats.length) {
    container.textContent = "Aún no hay gastos este mes.";
    container.className = "insights-empty";
    return;
  }
  container.className = "";
  const colors = ["violet", "blue", "teal"];
  container.replaceChildren(
    ...cats.map((item, i) => {
      const row = document.createElement("article");
      row.className = "insight-row";
      row.innerHTML = `<div class="insight-heading"><strong></strong><span><b></b><small></small></span></div><div class="insight-track"><span></span></div>`;
      row.querySelector("strong").textContent = item.category;
      row.querySelector("b").textContent = `${item.percentage}%`;
      row.querySelector("small").textContent = formatCurrency(item.amount);
      const bar = row.querySelector(".insight-track span");
      bar.className = `insight-bar ${colors[i]}`;
      bar.style.width = `${item.percentage}%`;
      return row;
    })
  );
}

function renderTransactionItem(t) {
  const item = document.createElement("li");
  item.className = "transaction-item";
  const sign = t.type === "income" ? "+" : "-";
  item.innerHTML = `<span class="category-icon" aria-hidden="true"></span><span class="transaction-details"><strong></strong><small></small></span><strong class="transaction-amount ${t.type === "income" ? "positive" : "negative"}"></strong>`;
  item.querySelector(".category-icon").textContent =
    t.category.charAt(0).toUpperCase();
  item.querySelector(".transaction-details strong").textContent =
    t.description;
  item.querySelector(".transaction-details small").textContent =
    `${t.category} · ${new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(`${t.date.slice(0, 10)}T12:00:00`))}`;
  item.querySelector(".transaction-amount").textContent =
    `${sign}${formatCurrency(t.amount)}`;
  return item;
}

export function renderDashboard() {
  const s = getState();
  const txns = s.transactions;
  const data = document.querySelector("#dashboard-data");
  const empty = document.querySelector("#dashboard-empty");
  data.hidden = txns.length === 0;
  empty.hidden = txns.length !== 0;
  if (!txns.length) return;

  const cm = currentMonthPrefix();
  const balance = txns.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0
  );
  const mTxns = txns.filter((t) => t.date.startsWith(cm));
  const income = mTxns
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);
  const expenses = mTxns
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  document.querySelector("#total-balance").textContent = formatCurrency(balance);
  document.querySelector("#monthly-income").textContent =
    `+${formatCurrency(income)}`;
  document.querySelector("#monthly-expenses").textContent =
    `-${formatCurrency(expenses)}`;

  const activeDebts = s.debts.filter((d) => d.status === "active");
  const totalMin = activeDebts.reduce((acc, d) => acc + d.minimum_payment, 0);
  const debtSum = document.querySelector("#monthly-debt-summary");
  if (activeDebts.length) {
    debtSum.hidden = false;
    document.querySelector("#monthly-debt-minimum").textContent =
      `-${formatCurrency(totalMin)}`;
    const rem = document.querySelector("#monthly-remaining");
    rem.textContent = formatCurrency(income - expenses - totalMin);
    rem.className = `money ${income - expenses - totalMin >= 0 ? "positive" : "negative"}`;
  } else {
    debtSum.hidden = true;
  }

  renderInsights(txns);

  const list = document.querySelector("#transaction-list");
  const sorted = txns
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const visible = s.showAllTransactions ? sorted : sorted.slice(0, 3);
  document.querySelector("#all-transactions-button").textContent =
    s.showAllTransactions ? "Ver menos" : "Ver todos";
  list.replaceChildren(...visible.map((t) => renderTransactionItem(t)));
}
