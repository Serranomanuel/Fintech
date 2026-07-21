import { getState } from "../state.js";
import {
  formatCurrency,
  getPeriodLabel,
  isDateInRange,
  groupTransactionsByDate,
  historyDateLabel,
  esc,
} from "../utils.js";

export function renderPeriodTransactions() {
  const s = getState();
  const txns = s.transactions.filter((t) =>
    isDateInRange(t.date, s.activePeriod)
  );
  const summary = document.querySelector("#period-summary");
  const container = document.querySelector("#period-transactions");
  const income = txns
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);
  const expenses = txns
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);
  const net = income - expenses;

  summary.innerHTML = `<div class="period-card"><p class="eyebrow">${getPeriodLabel(s.activePeriod)}</p><div class="period-stats"><div><small>Ingresos</small><strong class="positive">${formatCurrency(income)}</strong></div><div><small>Gastos</small><strong class="negative">${formatCurrency(expenses)}</strong></div><div><small>Neto</small><strong class="${net >= 0 ? "positive" : "negative"}">${formatCurrency(net)}</strong></div></div></div>`;

  if (!txns.length) {
    container.innerHTML =
      '<div class="empty-state"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5V3Z"/><path d="M15 3v5h4M8 13h8M8 17h5"/></svg><p>Sin movimientos en este período</p></div>';
    return;
  }

  const groups = groupTransactionsByDate(txns);
  container.replaceChildren(
    ...Object.entries(groups).map(([date, dTxns]) => {
      const sec = document.createElement("section");
      sec.className = "history-group";
      const h = document.createElement("h2");
      h.className = "history-date";
      h.textContent = historyDateLabel(date);
      const list = document.createElement("ul");
      list.className = "history-transactions";
      dTxns.forEach((t) => {
        const li = document.createElement("li");
        li.className = "history-transaction";
        const sign = t.type === "income" ? "+" : "-";
        li.innerHTML = `<span class="category-icon" aria-hidden="true"></span><span class="transaction-details"><strong></strong><small></small></span><span class="history-amount"><strong class="transaction-amount ${t.type === "income" ? "positive" : "negative"}"></strong><button class="edit-txn-btn" type="button" data-transaction-id="${t.id}" aria-label="Editar"><svg aria-hidden="true" viewBox="0 0 24 24" width="14"><path d="M15.232 5.232l3.536 3.536M9 11l-2 12 12-2 2-9.5-9.5 9.5z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg></button><button class="delete-button" type="button" data-transaction-id="${t.id}" aria-label="Eliminar"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"/></svg></button></span>`;
        li.querySelector(".category-icon").textContent =
          t.category.charAt(0).toUpperCase();
        li.querySelector(".transaction-details strong").textContent =
          t.description;
        li.querySelector(".transaction-details small").textContent =
          t.category;
        li.querySelector(".transaction-amount").textContent =
          `${sign}${formatCurrency(t.amount)}`;
        list.append(li);
      });
      sec.append(h, list);
      return sec;
    })
  );
}
