const LOCALES = { COP: "es-CO", USD: "en-US", EUR: "de-DE", MXN: "es-MX" };

let _currency = "COP";
let _formatter = null;

export function setCurrency(c) {
  _currency = c;
  _formatter = null;
}

function getFormatter() {
  if (!_formatter) {
    const fd = _currency === "COP" ? 0 : 2;
    _formatter = new Intl.NumberFormat(LOCALES[_currency] || "es-CO", {
      style: "currency",
      currency: _currency,
      minimumFractionDigits: fd,
      maximumFractionDigits: fd,
    });
  }
  return _formatter;
}

export function formatCurrency(amount) {
  return getFormatter().format(amount);
}

export function formatDate(d) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${d.slice(0, 10)}T12:00:00`));
}

export function formatFullDate(d) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${d.slice(0, 10)}T12:00:00`));
}

export function formatShortDateTime(d) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function categoryInitial(c) {
  return c.charAt(0).toUpperCase();
}

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseAmount(v) {
  const s = v.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      return Number(s.replace(/\./g, "").replace(",", "."));
    }
    return Number(s.replace(/,/g, ""));
  }
  if (hasComma) return Number(s.replace(",", "."));
  return Number(s);
}

export function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export function isDateInRange(dateStr, period) {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  const now = new Date();
  if (period === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay());
    s.setHours(0, 0, 0, 0);
    return d >= s;
  }
  if (period === "month") {
    return d >= new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "year") {
    return d >= new Date(now.getFullYear(), 0, 1);
  }
  return true;
}

export function getPeriodLabel(p) {
  if (p === "week") return "Esta semana";
  if (p === "month")
    return new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(new Date());
  if (p === "year")
    return new Intl.DateTimeFormat("es-CO", { year: "numeric" }).format(
      new Date()
    );
  return "Todos los tiempos";
}

export function groupTransactionsByDate(txns) {
  return txns
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce((g, t) => {
      const d = t.date.slice(0, 10);
      (g[d] = g[d] || []).push(t);
      return g;
    }, {});
}

export function historyDateLabel(date) {
  const today = todayISO();
  const now = new Date();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  );
  const yesterdayISO = new Date(
    yesterday.getTime() - yesterday.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
  if (date === today) return "Hoy";
  if (date === yesterdayISO) return "Ayer";
  return formatFullDate(date);
}

export function calculateTopCategories(txns) {
  const cm = currentMonthPrefix();
  const totals = txns
    .filter((t) => t.type === "expense" && t.date.startsWith(cm))
    .reduce((c, t) => {
      c[t.category] = (c[t.category] || 0) + t.amount;
      return c;
    }, {});
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  if (!total) return [];
  return Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
}

export function daysUntilDeadline(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / 86400000);
}
