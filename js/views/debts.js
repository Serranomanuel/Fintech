import { getState } from "../state.js";
import { formatCurrency, esc } from "../utils.js";
import { fetchDebtPayments } from "../../supabaseService.js";

export function renderDebts() {
  const s = getState();
  const all = s.debts;
  const active = all.filter((d) => d.status === "active");
  const totalDebt = active.reduce((acc, d) => acc + d.remaining_amount, 0);
  const totalOrig = active.reduce((acc, d) => acc + d.total_amount, 0);
  const paidOff = totalOrig - totalDebt;
  const pct =
    totalOrig > 0 ? Math.round((paidOff / totalOrig) * 100) : 0;

  document.querySelector("#debts-summary-cards").innerHTML = `
    <div class="debt-stat-card"><small>Deuda total</small><strong>${formatCurrency(totalDebt)}</strong></div>
    <div class="debt-stat-card"><small>Ya pagado</small><strong class="positive">${formatCurrency(paidOff)}</strong></div>
    <div class="debt-stat-card"><small>Progreso</small><strong>${pct}%</strong><div class="debt-progress-track"><span class="debt-progress-bar" style="width:${pct}%"></span></div></div>`;

  const data = document.querySelector("#debts-data");
  const empty = document.querySelector("#debts-empty");
  if (!all.length) {
    data.hidden = true;
    empty.hidden = false;
    return;
  }
  data.hidden = false;
  empty.hidden = true;

  document
    .querySelector("#debts-list")
    .replaceChildren(
      ...all.map((debt) => {
        const paid = debt.total_amount - debt.remaining_amount;
        const prog =
          debt.total_amount > 0
            ? Math.round((paid / debt.total_amount) * 100)
            : 0;
        const isPaid = debt.status === "paid" || debt.remaining_amount <= 0;
        const card = document.createElement("article");
        card.className = `debt-card ${isPaid ? "debt-card-paid" : ""}`;
        card.innerHTML = `
      <div class="debt-card-header"><div class="debt-card-title"><h3>${esc(debt.name)}</h3><small>${esc(debt.creditor || "Sin acreedor")}</small></div><span class="debt-status ${isPaid ? "status-paid" : "status-active"}">${isPaid ? "Pagada" : "Activa"}</span></div>
      <div class="debt-card-amounts"><div><small>Restante</small><strong class="${isPaid ? "" : "negative"}">${formatCurrency(debt.remaining_amount)}</strong></div><div><small>Cuota mín.</small><strong>${formatCurrency(debt.minimum_payment)}</strong></div><div><small>Vence día</small><strong>${debt.due_day}</strong></div></div>
      <div class="debt-progress-track large"><span class="debt-progress-bar ${isPaid ? "bar-paid" : ""}" style="width:${prog}%"></span></div>
      <div class="debt-progress-label"><span>${prog}% pagado</span><span>${formatCurrency(paid)} / ${formatCurrency(debt.total_amount)}</span></div>
      <div class="debt-card-actions">${!isPaid ? `<button class="debt-action-btn pay-btn" type="button" data-debt-id="${debt.id}">Registrar pago</button>` : ""}<button class="debt-action-btn edit-debt-btn" type="button" data-debt-id="${debt.id}">Editar</button><button class="debt-action-btn detail-btn" type="button" data-debt-id="${debt.id}">Detalle</button><button class="debt-action-btn delete-debt-btn" type="button" data-debt-id="${debt.id}" aria-label="Eliminar"><svg aria-hidden="true" viewBox="0 0 24 24" width="16"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg></button></div>`;
        return card;
      })
    );
}

export function renderDebtDetail(debtId) {
  const s = getState();
  const debt = s.debts.find((d) => d.id === debtId);
  if (!debt) return;
  s.selectedDebtId = debtId;

  document.getElementById("debt-detail-title").textContent = debt.name;
  fetchDebtPayments(debtId).then((payments) => {
    const paid = debt.total_amount - debt.remaining_amount;
    const prog =
      debt.total_amount > 0
        ? Math.round((paid / debt.total_amount) * 100)
        : 0;
    const content = document.getElementById("debt-detail-content");
    content.innerHTML = `
      <div class="debt-detail-summary">
        <div class="debt-detail-row"><small>Acreedor</small><strong>${esc(debt.creditor || "—")}</strong></div>
        <div class="debt-detail-row"><small>Monto original</small><strong>${formatCurrency(debt.total_amount)}</strong></div>
        <div class="debt-detail-row"><small>Restante</small><strong class="negative">${formatCurrency(debt.remaining_amount)}</strong></div>
        <div class="debt-detail-row"><small>Cuota mínima</small><strong>${formatCurrency(debt.minimum_payment)}</strong></div>
        <div class="debt-detail-row"><small>Interés</small><strong>${debt.interest_rate}%</strong></div>
        <div class="debt-detail-row"><small>Día de pago</small><strong>${debt.due_day} de cada mes</strong></div>
        <div class="debt-detail-row"><small>Progreso</small><strong>${prog}%</strong></div>
        <div class="debt-progress-track large"><span class="debt-progress-bar" style="width:${prog}%"></span></div>
      </div>
      <h3 class="section-label">Historial de pagos</h3>
      <div class="payment-history-list" id="debt-payments-list"></div>`;
    const list = document.getElementById("debt-payments-list");
    if (!payments.length) {
      list.innerHTML =
        '<p class="empty-text">Aún no hay pagos registrados.</p>';
      return;
    }
    list.replaceChildren(
      ...payments.map((p) => {
        const el = document.createElement("div");
        el.className = "debt-payment-item";
        el.innerHTML = `<div class="payment-info"><strong>${formatCurrency(p.amount)}</strong><small>${new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(p.payment_date))}</small>${p.note ? `<small class="payment-note">${esc(p.note)}</small>` : ""}</div><button class="delete-button" type="button" data-payment-id="${p.id}" data-debt-id="${debt.id}" data-payment-amount="${p.amount}" aria-label="Eliminar pago"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"/></svg></button>`;
        return el;
      })
    );
  });
}
