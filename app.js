import {
  addTransaction,
  deleteTransaction,
  fetchProfile,
  fetchTransactions,
  getSession,
  isSupabaseConfigured,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
  updateUserCurrency
} from "./supabaseService.js";

const DEFAULT_CURRENCY = "COP";
let activeUser = null;
let transactions = [];
let currentCurrency = DEFAULT_CURRENCY;
let authMode = "signin";

function getCurrencyFormatter(currency) {
  const locales = { COP: "es-CO", USD: "en-US", EUR: "de-DE", MXN: "es-MX" };
  const locale = locales[currency] || "es-CO";
  const fractionDigits = currency === "COP" ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function getCurrency() {
  return currentCurrency;
}

function formatCurrency(amount) {
  return getCurrencyFormatter(getCurrency()).format(amount);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(`${dateString.slice(0, 10)}T12:00:00`));
}

function categoryInitial(category) {
  return category.charAt(0).toUpperCase();
}

function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getTransactions() {
  return transactions;
}

let showAllTransactions = false;
let currentView = "home";

function renderDashboard() {
  const transactions = getTransactions();
  const dashboardData = document.querySelector("#dashboard-data");
  const dashboardEmpty = document.querySelector("#dashboard-empty");
  dashboardData.hidden = transactions.length === 0;
  dashboardEmpty.hidden = transactions.length !== 0;
  if (!transactions.length) return;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const balance = transactions.reduce((total, transaction) => total + (transaction.type === "income" ? transaction.amount : -transaction.amount), 0);
  const monthlyTransactions = transactions.filter((transaction) => transaction.date.startsWith(currentMonth));
  const income = monthlyTransactions.filter((transaction) => transaction.type === "income").reduce((total, transaction) => total + transaction.amount, 0);
  const expenses = monthlyTransactions.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + transaction.amount, 0);

  document.querySelector("#total-balance").textContent = formatCurrency(balance);
  document.querySelector("#monthly-income").textContent = `+${formatCurrency(income)}`;
  document.querySelector("#monthly-expenses").textContent = `-${formatCurrency(expenses)}`;
  renderInsights(transactions);

  const list = document.querySelector("#transaction-list");
  const sortedTransactions = transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  const visibleTransactions = showAllTransactions ? sortedTransactions : sortedTransactions.slice(0, 3);
  document.querySelector("#all-transactions-button").textContent = showAllTransactions ? "Ver menos" : "Ver todos";
  list.replaceChildren(...visibleTransactions.map((transaction) => {
    const item = document.createElement("li");
    const sign = transaction.type === "income" ? "+" : "-";
    item.className = "transaction-item";
    const icon = document.createElement("span");
    icon.className = "category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = categoryInitial(transaction.category);

    const details = document.createElement("span");
    details.className = "transaction-details";
    const description = document.createElement("strong");
    description.textContent = transaction.description;
    const metadata = document.createElement("small");
    metadata.textContent = `${transaction.category} · ${formatDate(transaction.date)}`;
    details.append(description, metadata);

    const amount = document.createElement("strong");
    amount.className = `transaction-amount ${transaction.type === "income" ? "positive" : "negative"}`;
    amount.textContent = `${sign}${formatCurrency(transaction.amount)}`;
    item.append(icon, details, amount);
    return item;
  }));
}

function groupTransactionsByDate(transactions) {
  return transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).reduce((groups, transaction) => {
    const date = transaction.date.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {});
}

function calculateTopCategories(transactions) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const totals = transactions.filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(currentMonth)).reduce((categories, transaction) => {
    categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
    return categories;
  }, {});
  const totalExpenses = Object.values(totals).reduce((total, amount) => total + amount, 0);
  if (!totalExpenses) return [];
  return Object.entries(totals).map(([category, amount]) => ({
    category,
    amount,
    percentage: Math.round((amount / totalExpenses) * 100)
  })).sort((a, b) => b.amount - a.amount).slice(0, 3);
}

function renderInsights(transactions) {
  const container = document.querySelector("#insights-bars");
  const categories = calculateTopCategories(transactions);
  if (!categories.length) {
    container.textContent = "Aún no hay gastos este mes.";
    container.className = "insights-empty";
    return;
  }

  container.className = "";
  const colors = ["violet", "blue", "teal"];
  const bars = categories.map((item, index) => {
    const row = document.createElement("article");
    row.className = "insight-row";
    row.innerHTML = `<div class="insight-heading"><strong></strong><span><b></b><small></small></span></div><div class="insight-track"><span></span></div>`;
    row.querySelector("strong").textContent = item.category;
    row.querySelector("b").textContent = `${item.percentage}%`;
    row.querySelector("small").textContent = formatCurrency(item.amount);
    const bar = row.querySelector(".insight-track span");
    bar.className = `insight-bar ${colors[index]}`;
    bar.style.width = `${item.percentage}%`;
    return row;
  });
  container.replaceChildren(...bars);
}

function historyDateLabel(date) {
  const today = todayISO();
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === today) return "Hoy";
  if (date === yesterday.toISOString().slice(0, 10)) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}

function renderHistory() {
  const historyList = document.querySelector("#history-list");
  const transactions = getTransactions();
  const groups = groupTransactionsByDate(transactions);

  if (!transactions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5V3Z"/><path d="M15 3v5h4M8 13h8M8 17h5"/></svg><p>Sin movimientos</p>';
    historyList.replaceChildren(empty);
    return;
  }

  const sections = Object.entries(groups).map(([date, transactionsForDate]) => {
    const section = document.createElement("section");
    section.className = "history-group";
    const heading = document.createElement("h2");
    heading.className = "history-date";
    heading.textContent = historyDateLabel(date);
    const list = document.createElement("ul");
    list.className = "history-transactions";

    transactionsForDate.forEach((transaction) => {
      const item = document.createElement("li");
      item.className = "history-transaction";
      const sign = transaction.type === "income" ? "+" : "-";
      item.innerHTML = `<span class="category-icon" aria-hidden="true"></span><span class="transaction-details"><strong></strong><small></small></span><span class="history-amount"><strong class="transaction-amount ${transaction.type === "income" ? "positive" : "negative"}"></strong><button class="delete-button" type="button" data-transaction-id="${transaction.id}" aria-label="Eliminar movimiento"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"/></svg></button></span>`;
      item.querySelector(".category-icon").textContent = categoryInitial(transaction.category);
      item.querySelector(".transaction-details strong").textContent = transaction.description;
      item.querySelector(".transaction-details small").textContent = transaction.category;
      item.querySelector(".transaction-amount").textContent = `${sign}${formatCurrency(transaction.amount)}`;
      list.append(item);
    });
    section.append(heading, list);
    return section;
  });
  historyList.replaceChildren(...sections);
}

function renderViews() {
  renderDashboard();
  renderHistory();
  const currencyLabels = { COP: "COP · Peso colombiano", USD: "USD · Dólar estadounidense", EUR: "EUR · Euro", MXN: "MXN · Peso mexicano" };
  document.querySelector("#current-currency-label").textContent = currencyLabels[getCurrency()];
}

function setView(view) {
  currentView = view;
  document.querySelector("#home-view").hidden = view !== "home";
  document.querySelector("#history-view").hidden = view !== "history";
  document.querySelector("#settings-view").hidden = view !== "settings";
  const homeButton = document.querySelector("#home-nav-button");
  const historyButton = document.querySelector("#transactions-nav-button");
  const settingsButton = document.querySelector("#settings-nav-button");
  homeButton.classList.toggle("is-active", view === "home");
  historyButton.classList.toggle("is-active", view === "history");
  settingsButton.classList.toggle("is-active", view === "settings");
  homeButton.toggleAttribute("aria-current", view === "home");
  historyButton.toggleAttribute("aria-current", view === "history");
  settingsButton.toggleAttribute("aria-current", view === "settings");
  document.querySelector("#add-transaction-button").hidden = view !== "home";
  window.scrollTo(0, 0);
  renderViews();
}

let toastTimeout;
function showToast(message) {
  const toast = document.querySelector("#toast");
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

let lastTrigger;
function openModal(modalId, trigger) {
  const modal = document.querySelector(`#${modalId}`);
  lastTrigger = trigger;
  modal.hidden = false;
  document.body.classList.add("has-modal");
  window.setTimeout(() => modal.querySelector("input, button, select").focus(), 0);
}

function closeModal(modalId) {
  document.querySelector(`#${modalId}`).hidden = true;
  document.body.classList.remove("has-modal");
  lastTrigger?.focus();
}

function openTransactionModal(trigger) {
  const form = document.querySelector("#transaction-form");
  form.reset();
  selectCategory("Alimentación");
  updateTransactionForm("expense");
  updateAmountPreview();
  form.elements.date.value = todayISO();
  openModal("transaction-modal", trigger);
}

function openSettingsModal(trigger) {
  const currency = getCurrency();
  document.querySelector(`#settings-form input[value="${currency}"]`).checked = true;
  openModal("settings-modal", trigger);
}

function parseAmount(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function selectCategory(category) {
  document.querySelector("#transaction-category").value = category;
  document.querySelectorAll(".category-option").forEach((button) => {
    const selected = button.dataset.category === category;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function updateTransactionForm(type) {
  const sheet = document.querySelector(".transaction-sheet");
  const submitButton = document.querySelector(".transaction-submit");
  sheet.dataset.type = type;
  submitButton.textContent = type === "income" ? "Guardar ingreso" : "Guardar gasto";
}

function updateAmountPreview() {
  const input = document.querySelector("#transaction-amount");
  const preview = document.querySelector("#amount-preview");
  const amount = parseAmount(input.value);
  preview.textContent = Number.isFinite(amount) && amount > 0 ? formatCurrency(amount) : "";
}

function showAuthError(message) {
  const error = document.querySelector("#auth-error");
  error.textContent = message;
  error.hidden = !message;
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const password = document.querySelector("#auth-password");
  password.autocomplete = mode === "signin" ? "current-password" : "new-password";
  document.querySelector("#auth-submit").textContent = mode === "signin" ? "Iniciar sesión" : "Crear cuenta";
  showAuthError("");
}

function showAuth() {
  document.querySelector("#app-view").hidden = true;
  document.querySelector("#auth-view").hidden = false;
}

function showApp() {
  document.querySelector("#auth-view").hidden = true;
  document.querySelector("#app-view").hidden = false;
}

async function loadSession(session) {
  activeUser = session?.user || null;
  if (!activeUser) {
    transactions = [];
    currentCurrency = DEFAULT_CURRENCY;
    showAuth();
    return;
  }

  try {
    const [profile, remoteTransactions] = await Promise.all([fetchProfile(activeUser.id), fetchTransactions()]);
    currentCurrency = profile.preferred_currency || DEFAULT_CURRENCY;
    transactions = remoteTransactions;
    showApp();
    setView("home");
  } catch (error) {
    showAuth();
    showAuthError("No fue posible cargar tu información. Intenta iniciar sesión nuevamente.");
  }
}

async function bootstrap() {
  if (!isSupabaseConfigured) {
    showAuth();
    showAuthError("Configura la URL y la Anon Key de Supabase para continuar.");
    return;
  }
  try {
    await loadSession(await getSession());
    onAuthStateChange((session) => loadSession(session));
  } catch {
    showAuth();
    showAuthError("No fue posible conectar con el servicio. Revisa la configuración.");
  }
}

bootstrap();

document.querySelector("#settings-button").addEventListener("click", () => setView("settings"));
document.querySelector("#add-transaction-button").addEventListener("click", (event) => openTransactionModal(event.currentTarget));
document.querySelector("#home-nav-button").addEventListener("click", () => setView("home"));
document.querySelector("#all-transactions-button").addEventListener("click", () => {
  showAllTransactions = !showAllTransactions;
  renderDashboard();
});
document.querySelector("#transactions-nav-button").addEventListener("click", () => {
  setView("history");
});
document.querySelector("#settings-nav-button").addEventListener("click", () => setView("settings"));
document.querySelector("#currency-button").addEventListener("click", (event) => openSettingsModal(event.currentTarget));
document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));

document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal(modal.id);
}));
document.querySelectorAll("input[name=type]").forEach((input) => input.addEventListener("change", (event) => updateTransactionForm(event.target.value)));
document.querySelectorAll(".category-option").forEach((button) => button.addEventListener("click", () => selectCategory(button.dataset.category)));
document.querySelector("#transaction-amount").addEventListener("input", updateAmountPreview);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openModalElement = document.querySelector(".modal-backdrop:not([hidden])");
  if (openModalElement) closeModal(openModalElement.id);
});

document.querySelector("#transaction-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const amount = parseAmount(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Escribe un monto mayor que cero.");
    document.querySelector("#transaction-amount").focus();
    return;
  }

  if (!activeUser) return;
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  submitButton.disabled = true;
  const transaction = {
    user_id: activeUser.id,
    type: form.get("type"),
    amount,
    category: form.get("category").trim(),
    description: form.get("description").trim(),
    date: new Date(`${form.get("date")}T00:00:00Z`).toISOString()
  };
  try {
    const savedTransaction = await addTransaction(transaction);
    transactions = [savedTransaction, ...transactions];
    closeModal("transaction-modal");
    renderViews();
    showToast(transaction.type === "income" ? "Ingreso guardado." : "Gasto guardado.");
  } catch {
    showToast("No se pudo guardar el movimiento.");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const currency = new FormData(event.currentTarget).get("currency");
  try {
    await updateUserCurrency(currency);
    currentCurrency = currency;
    closeModal("settings-modal");
    renderViews();
    showToast("Moneda actualizada.");
  } catch {
    showToast("No se pudo actualizar la moneda.");
  }
});

document.querySelector("#history-list").addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".delete-button");
  if (!deleteButton) return;
  const transactionId = deleteButton.dataset.transactionId;
  try {
    await deleteTransaction(transactionId);
    transactions = transactions.filter((transaction) => transaction.id !== transactionId);
    renderViews();
    showToast("Movimiento eliminado.");
  } catch {
    showToast("No se pudo eliminar el movimiento.");
  }
});

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isSupabaseConfigured) return;
  const form = new FormData(event.currentTarget);
  const email = form.get("email").trim();
  const password = form.get("password");
  const submitButton = document.querySelector("#auth-submit");
  if (!email || !password) {
    showAuthError("Completa tu correo y contraseña.");
    return;
  }
  submitButton.disabled = true;
  showAuthError("");
  try {
    const data = authMode === "signin" ? await signIn(email, password) : await signUp(email, password);
    if (data.session) {
      await loadSession(data.session);
    } else {
      showAuthError("Revisa tu correo para confirmar la cuenta antes de iniciar sesión.");
    }
  } catch (error) {
    console.error("Auth error:", error);
    const msg = error.message || "";
    let message;
    if (msg.includes("Invalid login credentials")) message = "Correo o contraseña incorrectos.";
    else if (msg.includes("User already registered")) message = "Ya existe una cuenta con este correo.";
    else if (msg.includes("Email signups are disabled")) message = "El registro por correo está deshabilitado.";
    else if (msg.includes("Email not confirmed")) message = "Confirma tu correo antes de iniciar sesión.";
    else message = msg || "No fue posible completar la operación. Intenta nuevamente.";
    showAuthError(message);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  try {
    await signOut();
  } catch {
    showToast("No fue posible cerrar sesión.");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
