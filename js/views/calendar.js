import { getState } from "../state.js";
import { formatCurrency, formatFullDate, todayISO } from "../utils.js";

export function renderCalendar() {
  const s = getState();
  const container = document.querySelector("#calendar-events");
  if (!container) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const events = [];
  const activeDebts = s.debts.filter(d => d.status === "active");
  activeDebts.forEach(d => {
    let dueDay = d.due_day;
    if (dueDay > daysInMonth) dueDay = daysInMonth;
    const dueDate = new Date(year, month, dueDay);
    if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
    const diffDays = Math.ceil((dueDate - now) / 86400000);
    events.push({
      date: dueDate,
      day: dueDate.getDate(),
      label: d.name,
      detail: `Cuota: ${formatCurrency(d.minimum_payment)}`,
      type: "debt",
      urgency: diffDays <= 3 ? "urgent" : diffDays <= 7 ? "soon" : "normal",
    });
  });
  s.savingsPlans.filter(p => p.status === "active" && p.deadline).forEach(p => {
    const deadline = new Date(`${p.deadline.slice(0, 10)}T12:00:00`);
    if (deadline >= now) {
      const diffDays = Math.ceil((deadline - now) / 86400000);
      events.push({
        date: deadline,
        day: deadline.getDate(),
        label: p.name,
        detail: `Meta: ${formatCurrency(p.target_amount)}`,
        type: "savings",
        urgency: diffDays <= 3 ? "urgent" : diffDays <= 7 ? "soon" : "normal",
      });
    }
  });
  events.sort((a, b) => a.date - b.date);
  const calendarGrid = document.querySelector("#calendar-grid");
  if (calendarGrid) {
    calendarGrid.innerHTML = "";
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-day cal-day-empty";
      calendarGrid.appendChild(empty);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "cal-day";
      if (d === today) cell.classList.add("cal-today");
      const hasEvent = events.some(e => e.day === d);
      if (hasEvent) cell.classList.add("cal-has-event");
      const isUrgent = events.some(e => e.day === d && e.urgency === "urgent");
      if (isUrgent) cell.classList.add("cal-urgent");
      cell.innerHTML = `<span>${d}</span>`;
      calendarGrid.appendChild(cell);
    }
  }
  if (!events.length) {
    container.innerHTML = '<p class="empty-text">No hay pagos próximos este mes.</p>';
    return;
  }
  container.replaceChildren(
    ...events.map(ev => {
      const el = document.createElement("div");
      el.className = `cal-event cal-${ev.type} cal-${ev.urgency}`;
      el.innerHTML = `
        <div class="cal-event-date"><span class="cal-event-day">${ev.day}</span><small>${new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(ev.date)}</small></div>
        <div class="cal-event-info"><strong>${ev.label}</strong><small>${ev.detail}</small></div>
        <span class="cal-event-badge ${ev.type === "debt" ? "badge-debt" : "badge-savings"}">${ev.type === "debt" ? "Deuda" : "Ahorro"}</span>`;
      return el;
    })
  );
}
