import {
  addTransaction, deleteTransaction, updateTransaction, fetchProfile, fetchTransactions,
  getSession, isSupabaseConfigured, onAuthStateChange,
  signIn, signOut, signUp, updateUserCurrency,
  fetchDebts, addDebt, updateDebt, deleteDebt,
  addDebtPayment, fetchDebtPayments, deleteDebtPayment,
  fetchSavingsPlans, addSavingsPlan, updateSavingsPlan, deleteSavingsPlan,
  addSavingsDeposit, fetchSavingsDeposits, deleteSavingsDeposit,
  fetchBudgets, upsertBudget, deleteBudget
} from "./supabaseService.js";

import { getState, setState, onStateChange, resetState } from "./js/state.js";
import { setCurrency, formatCurrency, parseAmount, todayISO, exportTransactionsToCSV } from "./js/utils.js";
import { renderDashboard } from "./js/views/dashboard.js";
import { renderPeriodTransactions } from "./js/views/transactions.js";
import { renderDebts, renderDebtDetail } from "./js/views/debts.js";
import { renderSavings, renderSavingsDetail } from "./js/views/savings.js";
import {
  openModal, closeModal, openTransactionModal, openSettingsModal,
  openDebtModal, openPaymentModal, openSavingsModal, openDepositModal,
  openBudgetModal
} from "./js/modals.js";

// ── Selective re-render ──
function applyDarkMode(dark) {
  document.body.classList.toggle("light", !dark);
  const toggle = document.querySelector("#dark-mode-toggle");
  const label = document.querySelector("#dark-mode-label");
  if (toggle) toggle.setAttribute("aria-checked", String(!dark));
  if (label) label.textContent = dark ? "Oscuro" : "Claro";
  localStorage.setItem("finanzas_theme", dark ? "dark" : "light");
}

const savedTheme = localStorage.getItem("finanzas_theme");
const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
const initialDark = savedTheme ? savedTheme === "dark" : prefersDark;
applyDarkMode(initialDark);

onStateChange((s) => {
  setCurrency(s.currentCurrency);
  renderDashboard();
  if (s.currentView === "transactions") renderPeriodTransactions();
  if (s.currentView === "debts") renderDebts();
  if (s.currentView === "savings") renderSavings();
  const labels = { COP: "COP · Peso colombiano", USD: "USD · Dólar", EUR: "EUR · Euro", MXN: "MXN · Peso mexicano" };
  document.querySelector("#current-currency-label").textContent = labels[s.currentCurrency] || "";
  renderLoading(s.isLoading);
});

function renderLoading(isLoading) {
  ["dashboard-data", "debts-data", "savings-data"].forEach(id => {
    const el = document.querySelector(`#${id}`);
    if (!el) return;
    if (isLoading && el.hidden) {
      el.innerHTML = '<div class="loading-spinner"></div>';
      el.hidden = false;
    }
  });
  const dashEmpty = document.querySelector("#dashboard-empty");
  const debtsEmpty = document.querySelector("#debts-empty");
  const savingsEmpty = document.querySelector("#savings-empty");
  if (isLoading) {
    if (dashEmpty) dashEmpty.hidden = true;
    if (debtsEmpty) debtsEmpty.hidden = true;
    if (savingsEmpty) savingsEmpty.hidden = true;
  }
}

// ── Navigation ──
function setView(view) {
  setState({ currentView: view });
  ["home", "transactions", "debts", "savings", "settings"].forEach(v => {
    document.querySelector(`#${v}-view`).hidden = v !== view;
  });
  Object.entries({ home: "home", transactions: "transactions", debts: "debts", savings: "savings", settings: "settings" }).forEach(([key, id]) => {
    const btn = document.querySelector(`#${id}-nav-button`);
    btn.classList.toggle("is-active", key === view);
    btn.toggleAttribute("aria-current", key === view);
  });
  document.querySelector("#add-transaction-button").hidden = view !== "home";
  window.scrollTo(0, 0);
}

// ── Toast ──
let toastTimeout;
function showToast(msg) {
  const t = document.querySelector("#toast");
  clearTimeout(toastTimeout);
  t.textContent = msg;
  t.classList.add("is-visible");
  toastTimeout = setTimeout(() => t.classList.remove("is-visible"), 2600);
}

// ── Auth ──
function showAuth() {
  document.querySelector("#app-view").hidden = true;
  document.querySelector("#auth-view").hidden = false;
}
function showApp() {
  document.querySelector("#auth-view").hidden = true;
  document.querySelector("#app-view").hidden = false;
}
function showAuthError(msg) {
  const e = document.querySelector("#auth-error");
  e.textContent = msg;
  e.hidden = !msg;
}
function setAuthMode(mode) {
  setState({ authMode: mode });
  document.querySelectorAll("[data-auth-mode]").forEach(b => {
    const a = b.dataset.authMode === mode;
    b.classList.toggle("is-active", a);
    b.setAttribute("aria-selected", String(a));
  });
  document.querySelector("#auth-password").autocomplete = mode === "signin" ? "current-password" : "new-password";
  document.querySelector("#auth-submit").textContent = mode === "signin" ? "Iniciar sesión" : "Crear cuenta";
  showAuthError("");
}

async function loadSession(session) {
  const user = session?.user || null;
  if (!user) {
    resetState();
    showAuth();
    return;
  }
  setState({ isLoading: true });
  try {
    const [profile, txns, dts, svgs, bds] = await Promise.all([
      fetchProfile(user.id),
      fetchTransactions(),
      fetchDebts(),
      fetchSavingsPlans(),
      fetchBudgets()
    ]);
    setState({
      activeUser: user,
      currentCurrency: profile.preferred_currency || "COP",
      transactions: txns,
      debts: dts,
      savingsPlans: svgs,
      budgets: bds,
      isLoading: false,
    });
    showApp();
    setView("home");
  } catch {
    setState({ isLoading: false });
    showAuth();
    showAuthError("No fue posible cargar tu información.");
  }
}

async function bootstrap() {
  if (!isSupabaseConfigured) {
    showAuth();
    showAuthError("Configura la URL y Anon Key de Supabase.");
    return;
  }
  try {
    await loadSession(await getSession());
    onAuthStateChange(s => loadSession(s));
  } catch {
    showAuth();
    showAuthError("No fue posible conectar con el servicio.");
  }
}

bootstrap();

// ── NAV events ──
document.querySelector("#settings-button").addEventListener("click", () => setView("settings"));
document.querySelector("#export-csv-button").addEventListener("click", () => {
  const txns = getState().transactions;
  if (!txns.length) { showToast("No hay movimientos para exportar."); return; }
  exportTransactionsToCSV(txns);
  showToast("CSV descargado.");
});
document.querySelector("#add-transaction-button").addEventListener("click", e => openTransactionModal(e.currentTarget));
document.querySelector("#home-nav-button").addEventListener("click", () => setView("home"));
document.querySelector("#transactions-nav-button").addEventListener("click", () => setView("transactions"));
document.querySelector("#debts-nav-button").addEventListener("click", () => setView("debts"));
document.querySelector("#savings-nav-button").addEventListener("click", () => setView("savings"));
document.querySelector("#settings-nav-button").addEventListener("click", () => setView("settings"));
document.querySelector("#dark-mode-button").addEventListener("click", () => {
  const isLight = document.body.classList.contains("light");
  applyDarkMode(isLight);
});
document.querySelector("#currency-button").addEventListener("click", e => openSettingsModal(e.currentTarget));
document.querySelector("#add-debt-button").addEventListener("click", e => openDebtModal(e.currentTarget));
document.querySelector("#add-savings-button").addEventListener("click", e => openSavingsModal(e.currentTarget));
document.querySelector("#add-budget-button").addEventListener("click", e => openBudgetModal(e.currentTarget));
document.querySelector("#all-transactions-button").addEventListener("click", () => {
  const s = getState();
  setState({ showAllTransactions: !s.showAllTransactions });
});

// ── Auth mode ──
document.querySelectorAll("[data-auth-mode]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.authMode)));

// ── Close modals ──
document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", () => closeModal(b.dataset.closeModal)));
document.querySelectorAll(".modal-backdrop").forEach(m => m.addEventListener("click", e => { if (e.target === m) closeModal(m.id); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") { const om = document.querySelector(".modal-backdrop:not([hidden])"); if (om) closeModal(om.id); } });

// ── Type / Category / Amount ──
document.querySelectorAll("input[name=type]").forEach(i => i.addEventListener("change", e => {
  document.querySelector(".transaction-sheet").dataset.type = e.target.value;
  document.querySelector(".transaction-submit").textContent = e.target.value === "income" ? "Guardar ingreso" : "Guardar gasto";
}));
document.querySelectorAll(".category-option").forEach(b => b.addEventListener("click", () => {
  document.querySelector("#transaction-category").value = b.dataset.category;
  document.querySelectorAll(".category-option").forEach(bb => {
    const sel = bb.dataset.category === b.dataset.category;
    bb.classList.toggle("is-selected", sel);
    bb.setAttribute("aria-pressed", String(sel));
  });
}));
document.querySelector("#transaction-amount").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#transaction-amount").value);
  document.querySelector("#amount-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});

// ── Period filters ──
document.querySelectorAll(".period-btn").forEach(btn => btn.addEventListener("click", () => {
  setState({ activePeriod: btn.dataset.period });
  document.querySelectorAll(".period-btn").forEach(b => {
    b.classList.toggle("is-active", b.dataset.period === getState().activePeriod);
    b.setAttribute("aria-selected", String(b.dataset.period === getState().activePeriod));
  });
}));

// ── Color selector ──
document.querySelectorAll("#savings-modal .color-option").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#savings-modal .color-option").forEach(b => b.classList.remove("is-selected"));
  btn.classList.add("is-selected");
  document.querySelector('#savings-form [name="color"]').value = btn.dataset.color;
}));

// ── FORM: Transaction ──
document.querySelector("#transaction-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const amount = parseAmount(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Escribe un monto mayor que cero."); return; }
  const s = getState();
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  const txData = {
    user_id: s.activeUser.id,
    type: form.get("type"),
    amount,
    category: form.get("category").trim(),
    description: form.get("description").trim(),
    date: new Date(`${form.get("date")}T00:00:00Z`).toISOString()
  };
  try {
    const editId = e.currentTarget.dataset.editId;
    if (editId) {
      const upd = await updateTransaction(editId, txData);
      setState({ transactions: s.transactions.map(t => t.id === editId ? upd : t) });
      closeModal("transaction-modal");
      showToast("Movimiento actualizado.");
    } else {
      const saved = await addTransaction(txData);
      setState({ transactions: [saved, ...s.transactions] });
      closeModal("transaction-modal");
      showToast(txData.type === "income" ? "Ingreso guardado." : "Gasto guardado.");
    }
  } catch {
    showToast("No se pudo guardar.");
  } finally {
    btn.disabled = false;
  }
});

// ── FORM: Currency ──
document.querySelector("#settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const c = new FormData(e.currentTarget).get("currency");
  try {
    await updateUserCurrency(c);
    setState({ currentCurrency: c });
    closeModal("settings-modal");
    showToast("Moneda actualizada.");
  } catch {
    showToast("No se pudo actualizar.");
  }
});

// ── FORM: Debt ──
document.querySelector("#debt-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const name = form.get("name").trim();
  const total = parseAmount(form.get("total_amount"));
  const min = parseAmount(form.get("minimum_payment"));
  const rate = parseAmount(form.get("interest_rate")) || 0;
  if (!name) { showToast("Escribe un nombre para la deuda."); return; }
  if (!Number.isFinite(total) || total <= 0) { showToast("Monto total inválido."); return; }
  if (!Number.isFinite(min) || min <= 0) { showToast("Cuota mínima inválida."); return; }
  const s = getState();
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  const debtData = {
    user_id: s.activeUser.id, name,
    creditor: form.get("creditor").trim() || "",
    total_amount: total, remaining_amount: total,
    interest_rate: rate, minimum_payment: min,
    due_day: parseInt(form.get("due_day"), 10) || 1,
    start_date: todayISO(), status: "active"
  };
  try {
    const editId = e.currentTarget.dataset.editId;
    if (editId) {
      const existing = s.debts.find(d => d.id === editId);
      const upd = await updateDebt(editId, {
        name: debtData.name,
        creditor: debtData.creditor,
        total_amount: debtData.total_amount,
        remaining_amount: Math.max(0, debtData.total_amount - (existing.total_amount - existing.remaining_amount)),
        interest_rate: debtData.interest_rate,
        minimum_payment: debtData.minimum_payment,
        due_day: debtData.due_day,
      });
      setState({ debts: s.debts.map(d => d.id === editId ? upd : d) });
      closeModal("debt-modal");
      showToast("Deuda actualizada.");
    } else {
      const saved = await addDebt(debtData);
      setState({ debts: [saved, ...s.debts] });
      closeModal("debt-modal");
      showToast("Deuda agregada.");
    }
  } catch {
    showToast("No se pudo guardar la deuda.");
  } finally {
    btn.disabled = false;
  }
});

// ── FORM: Debt Payment ──
document.querySelector("#payment-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const debtId = form.get("debt_id");
  const amount = parseAmount(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Monto inválido."); return; }
  const s = getState();
  const debt = s.debts.find(d => d.id === debtId);
  if (!debt) return;
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  if (amount > debt.remaining_amount) { showToast(`Excede lo que debes (${formatCurrency(debt.remaining_amount)}).`); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await addDebtPayment({ debt_id: debtId, user_id: s.activeUser.id, amount, note: form.get("note").trim() || "", payment_date: new Date().toISOString() });
    const newRem = Math.max(0, debt.remaining_amount - amount);
    const upd = await updateDebt(debtId, { remaining_amount: newRem, status: newRem <= 0 ? "paid" : debt.status });
    setState({ debts: s.debts.map(d => d.id === debtId ? upd : d) });
    closeModal("payment-modal");
    showToast("Pago registrado.");
    if (newRem <= 0) showToast("Felicidades, deuda pagada.");
  } catch {
    showToast("No se pudo registrar el pago.");
  } finally {
    btn.disabled = false;
  }
});

// ── FORM: Savings Plan ──
document.querySelector("#savings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const name = form.get("name").trim();
  const target = parseAmount(form.get("target_amount"));
  if (!name) { showToast("Escribe un nombre para el plan."); return; }
  if (!Number.isFinite(target) || target <= 0) { showToast("Meta inválida."); return; }
  const s = getState();
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  const planData = {
    user_id: s.activeUser.id, name,
    target_amount: target, current_amount: 0,
    deadline: form.get("deadline") || null,
    months: form.get("months") ? parseInt(form.get("months")) : null,
    color: form.get("color") || "violet",
    status: "active"
  };
  try {
    const editId = e.currentTarget.dataset.editId;
    if (editId) {
      const existing = s.savingsPlans.find(p => p.id === editId);
      const upd = await updateSavingsPlan(editId, {
        name: planData.name,
        target_amount: planData.target_amount,
        deadline: planData.deadline,
        months: planData.months,
        color: planData.color,
      });
      setState({ savingsPlans: s.savingsPlans.map(p => p.id === editId ? upd : p) });
      closeModal("savings-modal");
      showToast("Plan actualizado.");
    } else {
      const saved = await addSavingsPlan(planData);
      setState({ savingsPlans: [saved, ...s.savingsPlans] });
      closeModal("savings-modal");
      showToast("Plan de ahorro creado.");
    }
  } catch {
    showToast("No se pudo guardar el plan.");
  } finally {
    btn.disabled = false;
  }
});

// ── FORM: Savings Deposit ──
document.querySelector("#deposit-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const planId = form.get("plan_id");
  const amount = parseAmount(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Monto inválido."); return; }
  const s = getState();
  const plan = s.savingsPlans.find(p => p.id === planId);
  if (!plan) return;
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await addSavingsDeposit({ plan_id: planId, user_id: s.activeUser.id, amount, note: form.get("note").trim() || "", deposit_date: new Date().toISOString() });
    const newCurrent = plan.current_amount + amount;
    const newStatus = newCurrent >= plan.target_amount ? "completed" : plan.status;
    const upd = await updateSavingsPlan(planId, { current_amount: newCurrent, status: newStatus });
    setState({ savingsPlans: s.savingsPlans.map(p => p.id === planId ? upd : p) });
    closeModal("deposit-modal");
    showToast("Ahorro registrado.");
    if (newStatus === "completed") showToast("Felicidades, meta alcanzada.");
  } catch {
    showToast("No se pudo registrar el ahorro.");
  } finally {
    btn.disabled = false;
  }
});

// ── FORM: Budget ──
document.querySelector("#budget-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const category = form.get("category");
  const limit = parseAmount(form.get("monthly_limit"));
  if (!category) { showToast("Selecciona una categoría."); return; }
  if (!Number.isFinite(limit) || limit <= 0) { showToast("Límite inválido."); return; }
  const s = getState();
  if (!s.activeUser) { showToast("Sesión expirada."); return; }
  const btn = e.currentTarget.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const existing = s.budgets.find(b => b.category === category);
    if (existing) {
      const upd = await upsertBudget({ id: existing.id, user_id: s.activeUser.id, category, monthly_limit: limit });
      setState({ budgets: s.budgets.map(b => b.id === existing.id ? upd : b) });
    } else {
      const saved = await upsertBudget({ user_id: s.activeUser.id, category, monthly_limit: limit });
      setState({ budgets: [...s.budgets, saved] });
    }
    closeModal("budget-modal");
    showToast("Presupuesto guardado.");
  } catch {
    showToast("No se pudo guardar el presupuesto.");
  } finally {
    btn.disabled = false;
  }
});

// ── Amount previews ──
document.querySelector("#debt-amount").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#debt-amount").value);
  document.querySelector("#debt-amount-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});
document.querySelector("#payment-amount").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#payment-amount").value);
  document.querySelector("#payment-amount-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});
document.querySelector("#savings-target").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#savings-target").value);
  document.querySelector("#savings-target-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});
document.querySelector("#deposit-amount").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#deposit-amount").value);
  document.querySelector("#deposit-amount-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});
document.querySelector("#budget-amount").addEventListener("input", () => {
  const a = parseAmount(document.querySelector("#budget-amount").value);
  document.querySelector("#budget-amount-preview").textContent = Number.isFinite(a) && a > 0 ? formatCurrency(a) : "";
});

// ── DEBT ACTIONS (delegated) ──
document.querySelector("#debts-list").addEventListener("click", e => {
  const s = getState();
  const pay = e.target.closest(".pay-btn");
  if (pay) { openPaymentModal(pay.dataset.debtId, pay); return; }
  const edit = e.target.closest(".edit-debt-btn");
  if (edit) {
    const debt = s.debts.find(d => d.id === edit.dataset.debtId);
    if (debt) openDebtModal(edit, debt);
    return;
  }
  const det = e.target.closest(".detail-btn");
  if (det) { openModal("debt-detail-modal", det); renderDebtDetail(det.dataset.debtId); return; }
  const del = e.target.closest(".delete-debt-btn");
  if (del) {
    const id = del.dataset.debtId;
    const d = s.debts.find(x => x.id === id);
    if (d && confirm(`¿Eliminar "${d.name}"?`)) {
      deleteDebt(id).then(() => {
        setState({ debts: s.debts.filter(x => x.id !== id) });
        showToast("Deuda eliminada.");
      }).catch(() => showToast("Error al eliminar."));
    }
  }
});

// ── DEBT DETAIL PAYMENTS (delegated) ──
document.querySelector("#debt-payments-list")?.addEventListener("click", async e => {
  const del = e.target.closest(".delete-button");
  if (!del) return;
  if (!confirm("¿Eliminar este pago?")) return;
  const { paymentId, debtId, paymentAmount } = del.dataset;
  const s = getState();
  const debt = s.debts.find(d => d.id === debtId);
  if (!debt) return;
  const amt = Number(paymentAmount);
  try {
    await deleteDebtPayment({ id: paymentId });
    const newRem = Math.min(debt.total_amount, debt.remaining_amount + amt);
    const upd = await updateDebt(debtId, { remaining_amount: newRem, status: newRem < debt.total_amount ? "active" : debt.status });
    setState({ debts: s.debts.map(d => d.id === debtId ? upd : d) });
    renderDebtDetail(debtId);
    showToast("Pago eliminado.");
  } catch {
    showToast("Error al eliminar.");
  }
});

// ── SAVINGS ACTIONS (delegated) ──
document.querySelector("#savings-list").addEventListener("click", e => {
  const s = getState();
  const dep = e.target.closest(".deposit-btn");
  if (dep) { openDepositModal(dep.dataset.planId, dep); return; }
  const edit = e.target.closest(".edit-plan-btn");
  if (edit) {
    const plan = s.savingsPlans.find(p => p.id === edit.dataset.planId);
    if (plan) openSavingsModal(edit, plan);
    return;
  }
  const det = e.target.closest(".detail-btn");
  if (det) { openModal("savings-detail-modal", det); renderSavingsDetail(det.dataset.planId); return; }
  const del = e.target.closest(".delete-btn");
  if (del) {
    const id = del.dataset.planId;
    const p = s.savingsPlans.find(x => x.id === id);
    if (p && confirm(`¿Eliminar "${p.name}"?`)) {
      deleteSavingsPlan(id).then(() => {
        setState({ savingsPlans: s.savingsPlans.filter(x => x.id !== id) });
        showToast("Plan eliminado.");
      }).catch(() => showToast("Error al eliminar."));
    }
  }
});

// ── SAVINGS DETAIL DEPOSITS (delegated) ──
document.querySelector("#savings-deposits-list")?.addEventListener("click", async e => {
  const del = e.target.closest(".delete-button");
  if (!del) return;
  if (!confirm("¿Eliminar este depósito?")) return;
  const { depositId, planId } = del.dataset;
  const s = getState();
  const plan = s.savingsPlans.find(p => p.id === planId);
  if (!plan) return;
  try {
    await deleteSavingsDeposit({ id: depositId });
    const dep = await fetchSavingsDeposits(planId);
    const newCurrent = dep.reduce((acc, d) => acc + d.amount, 0);
    const newStatus = newCurrent >= plan.target_amount ? "completed" : "active";
    const upd = await updateSavingsPlan(planId, { current_amount: newCurrent, status: newStatus });
    setState({ savingsPlans: s.savingsPlans.map(p => p.id === planId ? upd : p) });
    renderSavingsDetail(planId);
    showToast("Depósito eliminado.");
  } catch {
    showToast("Error al eliminar.");
  }
});

// ── DELEGATED: period transactions actions ──
document.querySelector("#period-transactions").addEventListener("click", async e => {
  const s = getState();
  const editBtn = e.target.closest(".edit-txn-btn");
  if (editBtn) {
    const txn = s.transactions.find(t => t.id === editBtn.dataset.transactionId);
    if (txn) openTransactionModal(editBtn, txn);
    return;
  }
  const del = e.target.closest(".delete-button");
  if (!del) return;
  try {
    await deleteTransaction(del.dataset.transactionId);
    setState({ transactions: s.transactions.filter(t => t.id !== del.dataset.transactionId) });
    showToast("Movimiento eliminado.");
  } catch {
    showToast("No se pudo eliminar.");
  }
});

// ── AUTH ──
document.querySelector("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!isSupabaseConfigured) return;
  const form = new FormData(e.currentTarget);
  const email = form.get("email").trim();
  const password = form.get("password");
  const btn = document.querySelector("#auth-submit");
  if (!email || !password) { showAuthError("Completa tu correo y contraseña."); return; }
  btn.disabled = true;
  showAuthError("");
  try {
    const mode = getState().authMode;
    const data = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    if (data.session) await loadSession(data.session);
    else showAuthError("Revisa tu correo para confirmar la cuenta.");
  } catch (err) {
    const msg = err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message === "User already registered" ? "Ya existe una cuenta con este correo." : "No fue posible completar la operación.";
    showAuthError(msg);
  } finally {
    btn.disabled = false;
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  try { await signOut(); }
  catch { showToast("No fue posible cerrar sesión."); }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
