import { getState } from "./state.js";
import { formatCurrency, parseAmount, todayISO } from "./utils.js";

let lastTrigger = null;

export function openModal(id, trigger) {
  const m = document.querySelector(`#${id}`);
  lastTrigger = trigger;
  m.hidden = false;
  document.body.classList.add("has-modal");
  setTimeout(() => {
    const f = m.querySelector(
      "input:not([type=hidden]), button:not(.modal-close)"
    );
    if (f) f.focus();
  }, 0);
}

export function closeModal(id) {
  document.querySelector(`#${id}`).hidden = true;
  document.body.classList.remove("has-modal");
  lastTrigger?.focus();
}

export function openTransactionModal(trigger, editData) {
  const f = document.querySelector("#transaction-form");
  f.reset();
  selectCategory("Alimentación");
  updateTransactionForm("expense");
  updateAmountPreview();
  f.elements.date.value = todayISO();

  if (editData) {
    f.dataset.editId = editData.id;
    f.elements.type.value = editData.type;
    updateTransactionForm(editData.type);
    f.elements.amount.value = editData.amount;
    updateAmountPreview();
    selectCategory(editData.category);
    f.elements.description.value = editData.description;
    const d = new Date(editData.date);
    f.elements.date.value = new Date(
      d.getTime() + d.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 10);
    document.querySelector("#transaction-modal-title").textContent =
      "Editar movimiento";
    document.querySelector(".transaction-submit").textContent =
      editData.type === "income" ? "Actualizar ingreso" : "Actualizar gasto";
  } else {
    delete f.dataset.editId;
    document.querySelector("#transaction-modal-title").textContent =
      "Nuevo movimiento";
  }

  openModal("transaction-modal", trigger);
}

export function openSettingsModal(trigger) {
  const s = getState();
  const radio = document.querySelector(
    `#settings-form input[value="${s.currentCurrency}"]`
  );
  if (radio) radio.checked = true;
  openModal("settings-modal", trigger);
}

export function openDebtModal(trigger, editData) {
  const f = document.querySelector("#debt-form");
  f.reset();
  document.querySelector("#debt-amount-preview").textContent = "";

  if (editData) {
    f.dataset.editId = editData.id;
    f.elements.name.value = editData.name;
    f.elements.creditor.value = editData.creditor || "";
    f.elements.total_amount.value = editData.total_amount;
    f.elements.minimum_payment.value = editData.minimum_payment;
    f.elements.interest_rate.value = editData.interest_rate || "";
    f.elements.due_day.value = editData.due_day;
    document.querySelector("#debt-amount-preview").textContent =
      formatCurrency(editData.total_amount);
    document.querySelector("#debt-modal-title").textContent = "Editar deuda";
  } else {
    delete f.dataset.editId;
    document.querySelector("#debt-modal-title").textContent = "Nueva deuda";
  }

  openModal("debt-modal", trigger);
}

export function openPaymentModal(debtId, trigger) {
  const s = getState();
  const debt = s.debts.find((d) => d.id === debtId);
  if (!debt) return;
  s.selectedDebtId = debtId;
  document.getElementById("payment-debt-id").value = debtId;
  document.getElementById("payment-amount").value = "";
  document.getElementById("payment-amount-preview").textContent = "";
  document.querySelector('#payment-form [name="note"]').value = "";
  const paid = debt.total_amount - debt.remaining_amount;
  const prog =
    debt.total_amount > 0 ? Math.round((paid / debt.total_amount) * 100) : 0;
  document.getElementById(
    "payment-debt-info"
  ).innerHTML = `<div class="payment-debt-header"><strong>${debt.name}</strong><small>Restante: ${formatCurrency(debt.remaining_amount)}</small></div><div class="debt-progress-track"><span class="debt-progress-bar" style="width:${prog}%"></span></div>`;
  openModal("payment-modal", trigger);
}

export function openSavingsModal(trigger, editData) {
  const f = document.querySelector("#savings-form");
  f.reset();
  document.querySelector("#savings-target-preview").textContent = "";
  document.querySelector('#savings-form [name="color"]').value = "violet";
  document
    .querySelectorAll("#savings-modal .color-option")
    .forEach((b) =>
      b.classList.toggle("is-selected", b.dataset.color === "violet")
    );

  if (editData) {
    f.dataset.editId = editData.id;
    f.elements.name.value = editData.name;
    f.elements.target_amount.value = editData.target_amount;
    if (editData.deadline) f.elements.deadline.value = editData.deadline;
    if (editData.months) f.elements.months.value = editData.months;
    f.elements.color.value = editData.color;
    document
      .querySelectorAll("#savings-modal .color-option")
      .forEach((b) =>
        b.classList.toggle("is-selected", b.dataset.color === editData.color)
      );
    document.querySelector("#savings-target-preview").textContent =
      formatCurrency(editData.target_amount);
    document.querySelector("#savings-modal-title").textContent =
      "Editar plan de ahorro";
  } else {
    delete f.dataset.editId;
    document.querySelector("#savings-modal-title").textContent =
      "Nuevo plan de ahorro";
  }

  openModal("savings-modal", trigger);
}

export function openDepositModal(planId, trigger) {
  const s = getState();
  const plan = s.savingsPlans.find((p) => p.id === planId);
  if (!plan) return;
  s.selectedSavingsId = planId;
  document.getElementById("deposit-plan-id").value = planId;
  document.getElementById("deposit-amount").value = "";
  document.getElementById("deposit-amount-preview").textContent = "";
  document.querySelector('#deposit-form [name="note"]').value = "";
  const pct =
    plan.target_amount > 0
      ? Math.round(
          (Math.min(plan.current_amount, plan.target_amount) /
            plan.target_amount) *
            100
        )
      : 0;
  document.getElementById(
    "deposit-plan-info"
  ).innerHTML = `<div class="payment-debt-header"><strong>${plan.name}</strong><small>${formatCurrency(plan.current_amount)} de ${formatCurrency(plan.target_amount)}</small></div><div class="debt-progress-track"><span class="savings-progress-bar bar-${plan.color}" style="width:${pct}%"></span></div>`;
  openModal("deposit-modal", trigger);
}

export function openBudgetModal(trigger) {
  const f = document.querySelector("#budget-form");
  f.reset();
  document.querySelector("#budget-amount-preview").textContent = "";
  document.querySelector("#budget-modal-title").textContent = "Editar presupuesto";
  const s = getState();
  const cats = ["Alimentación", "Transporte", "Trabajo", "Vivienda", "Servicios", "Ocio"];
  const existing = s.budgets.find(b => b.category === document.querySelector('#budget-category').value);
  if (existing) {
    document.querySelector("#budget-amount").value = existing.monthly_limit;
    document.querySelector("#budget-amount-preview").textContent = formatCurrency(existing.monthly_limit);
  }
  openModal("budget-modal", trigger);
}

function selectCategory(c) {
  document.querySelector("#transaction-category").value = c;
  document.querySelectorAll(".category-option").forEach((b) => {
    const sel = b.dataset.category === c;
    b.classList.toggle("is-selected", sel);
    b.setAttribute("aria-pressed", String(sel));
  });
}

function updateTransactionForm(type) {
  document.querySelector(".transaction-sheet").dataset.type = type;
  document.querySelector(".transaction-submit").textContent =
    type === "income" ? "Guardar ingreso" : "Guardar gasto";
}

function updateAmountPreview() {
  const a = parseAmount(document.querySelector("#transaction-amount").value);
  document.querySelector("#amount-preview").textContent =
    Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
}


