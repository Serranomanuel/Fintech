import { getState } from "../state.js";
import {
  formatCurrency,
  formatFullDate,
  daysUntilDeadline,
  esc,
} from "../utils.js";
import { fetchSavingsDeposits } from "../../supabaseService.js";

export function renderSavings() {
  const s = getState();
  const all = s.savingsPlans;
  const active = all.filter((p) => p.status === "active");
  const completed = all.filter((p) => p.status === "completed");
  const totalSaved = all.reduce((acc, p) => acc + p.current_amount, 0);
  const totalTarget = active.reduce((acc, p) => acc + p.target_amount, 0);
  const overallPct =
    totalTarget > 0
      ? Math.round((Math.min(totalSaved, totalTarget) / totalTarget) * 100)
      : 0;

  document.querySelector("#savings-summary-cards").innerHTML = `
    <div class="savings-stat-card"><small>Total ahorrado</small><strong class="positive">${formatCurrency(totalSaved)}</strong></div>
    <div class="savings-stat-card"><small>Metas activas</small><strong>${active.length}</strong></div>
    <div class="savings-stat-card"><small>Completados</small><strong>${completed.length}</strong></div>`;

  const data = document.querySelector("#savings-data");
  const empty = document.querySelector("#savings-empty");
  if (!all.length) {
    data.hidden = true;
    empty.hidden = false;
    return;
  }
  data.hidden = false;
  empty.hidden = true;

  document
    .querySelector("#savings-list")
    .replaceChildren(
      ...all.map((plan) => {
        const pct =
          plan.target_amount > 0
            ? Math.round(
                (Math.min(plan.current_amount, plan.target_amount) /
                  plan.target_amount) *
                  100
              )
            : 0;
        const isCompleted =
          plan.status === "completed" ||
          plan.current_amount >= plan.target_amount;
        const remaining = Math.max(0, plan.target_amount - plan.current_amount);
        const days = daysUntilDeadline(plan.deadline);
        const card = document.createElement("article");
        card.className = `savings-card savings-card-${plan.color} ${isCompleted ? "savings-card-completed" : ""}`;
        card.innerHTML = `
      <div class="savings-card-header">
        <div class="savings-card-color"><span class="savings-dot dot-${plan.color}"></span></div>
        <div class="savings-card-title"><h3>${esc(plan.name)}</h3>${plan.deadline ? `<small>${days !== null ? (days >= 0 ? `${days} días restantes` : `Venció hace ${Math.abs(days)} días`) : new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(`${plan.deadline.slice(0, 10)}T12:00:00`))}</small>` : ""}</div>
        <span class="savings-status ${isCompleted ? "status-completed" : "status-active"}">${isCompleted ? "Completado" : "Activo"}</span>
      </div>
      <div class="savings-amounts">
        <div><small>Ahorrado</small><strong>${formatCurrency(plan.current_amount)}</strong></div>
        <div><small>Meta</small><strong>${formatCurrency(plan.target_amount)}</strong></div>
        <div><small>Faltante</small><strong>${formatCurrency(remaining)}</strong></div>
      </div>
      <div class="debt-progress-track large"><span class="savings-progress-bar bar-${plan.color}" style="width:${pct}%"></span></div>
      <div class="debt-progress-label"><span>${pct}% alcanzado</span><span>${formatCurrency(plan.current_amount)} / ${formatCurrency(plan.target_amount)}</span></div>
      <div class="debt-card-actions">
        ${!isCompleted ? `<button class="savings-action-btn deposit-btn" type="button" data-plan-id="${plan.id}">Agregar ahorro</button>` : ""}
        <button class="savings-action-btn edit-plan-btn" type="button" data-plan-id="${plan.id}">Editar</button>
        <button class="savings-action-btn detail-btn" type="button" data-plan-id="${plan.id}">Detalle</button>
        <button class="savings-action-btn delete-btn" type="button" data-plan-id="${plan.id}" aria-label="Eliminar plan">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>
        </button>
      </div>`;
        return card;
      })
    );
}

export function renderSavingsDetail(planId) {
  const s = getState();
  const plan = s.savingsPlans.find((p) => p.id === planId);
  if (!plan) return;
  s.selectedSavingsId = planId;

  document.getElementById("savings-detail-title").textContent = plan.name;
  fetchSavingsDeposits(planId).then((deposits) => {
    const pct =
      plan.target_amount > 0
        ? Math.round(
            (Math.min(plan.current_amount, plan.target_amount) /
              plan.target_amount) *
              100
          )
        : 0;
    const remaining = Math.max(0, plan.target_amount - plan.current_amount);
    const content = document.getElementById("savings-detail-content");
    content.innerHTML = `
      <div class="savings-detail-summary">
        <div class="savings-detail-color"><span class="savings-dot dot-${plan.color}"></span><span class="savings-detail-name">${esc(plan.name)}</span></div>
        <div class="debt-detail-row"><small>Meta</small><strong>${formatCurrency(plan.target_amount)}</strong></div>
        <div class="debt-detail-row"><small>Ahorrado</small><strong class="positive">${formatCurrency(plan.current_amount)}</strong></div>
        <div class="debt-detail-row"><small>Faltante</small><strong>${formatCurrency(remaining)}</strong></div>
        ${plan.deadline ? `<div class="debt-detail-row"><small>Fecha límite</small><strong>${formatFullDate(plan.deadline)}</strong></div>` : ""}
        <div class="debt-detail-row"><small>Progreso</small><strong>${pct}%</strong></div>
        <div class="debt-progress-track large"><span class="savings-progress-bar bar-${plan.color}" style="width:${pct}%"></span></div>
      </div>
      <h3 class="section-label">Historial de depósitos</h3>
      <div class="payment-history-list" id="savings-deposits-list"></div>`;
    const list = document.getElementById("savings-deposits-list");
    if (!deposits.length) {
      list.innerHTML =
        '<p class="empty-text">Aún no hay depósitos registrados.</p>';
      return;
    }
    list.replaceChildren(
      ...deposits.map((dep) => {
        const el = document.createElement("div");
        el.className = "debt-payment-item";
        el.innerHTML = `<div class="payment-info"><strong class="positive">+${formatCurrency(dep.amount)}</strong><small>${new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dep.deposit_date))}</small>${dep.note ? `<small class="payment-note">${esc(dep.note)}</small>` : ""}</div><button class="delete-button" type="button" data-deposit-id="${dep.id}" data-plan-id="${plan.id}" aria-label="Eliminar depósito"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"/></svg></button>`;
        return el;
      })
    );
  });
}
