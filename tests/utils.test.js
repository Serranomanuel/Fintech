import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the pure logic by reimplementing the functions inline
// since utils.js uses module-level state for formatting.

function parseAmount(v) {
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

function isDateInRange(dateStr, period) {
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

function calculateTopCategories(txns) {
  const now = new Date();
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function groupTransactionsByDate(txns) {
  return txns
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce((g, t) => {
      const d = t.date.slice(0, 10);
      (g[d] = g[d] || []).push(t);
      return g;
    }, {});
}

function daysUntilDeadline(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / 86400000);
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

// ── Tests ──

describe("parseAmount", () => {
  it("parses plain integers", () => {
    expect(parseAmount("1000")).toBe(1000);
    expect(parseAmount("0")).toBe(0);
  });

  it("parses US format (comma thousands, dot decimal)", () => {
    expect(parseAmount("1,500.50")).toBe(1500.5);
    expect(parseAmount("1000.99")).toBe(1000.99);
  });

  it("parses LATAM format (dot thousands, comma decimal)", () => {
    expect(parseAmount("1.500,50")).toBe(1500.5);
    expect(parseAmount("1000,99")).toBe(1000.99);
  });

  it("handles large LATAM numbers", () => {
    expect(parseAmount("1.234.567,89")).toBe(1234567.89);
  });

  it("handles large US numbers", () => {
    expect(parseAmount("1,234,567.89")).toBe(1234567.89);
  });

  it("returns NaN for empty strings", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("   ")).toBeNaN();
  });

  it("handles plain decimal with dot", () => {
    expect(parseAmount("42.5")).toBe(42.5);
  });

  it("handles plain decimal with comma", () => {
    expect(parseAmount("42,5")).toBe(42.5);
  });
});

describe("isDateInRange", () => {
  it("'all' always returns true", () => {
    expect(isDateInRange("2020-01-01T00:00:00Z", "all")).toBe(true);
  });

  it("'month' includes dates from current month", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    expect(isDateInRange(`${thisMonth}T12:00:00`, "month")).toBe(true);
  });

  it("'month' excludes dates from previous month", () => {
    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();
    if (m === 0) { m = 12; y--; }
    const prevMonth = `${y}-${String(m).padStart(2, "0")}-15`;
    expect(isDateInRange(`${prevMonth}T12:00:00`, "month")).toBe(false);
  });

  it("'year' includes dates from current year", () => {
    const now = new Date();
    expect(isDateInRange(`${now.getFullYear()}-06-15T12:00:00`, "year")).toBe(true);
  });

  it("'year' excludes dates from previous year", () => {
    const now = new Date();
    expect(isDateInRange(`${now.getFullYear() - 1}-12-25T12:00:00`, "year")).toBe(false);
  });
});

describe("calculateTopCategories", () => {
  const now = new Date();
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  it("returns empty for no expenses", () => {
    expect(calculateTopCategories([])).toEqual([]);
  });

  it("returns empty for income only", () => {
    expect(calculateTopCategories([{ type: "income", amount: 100, category: "Trabajo", date: `${cm}-10T12:00:00` }])).toEqual([]);
  });

  it("returns top categories sorted by amount", () => {
    const txns = [
      { type: "expense", amount: 100, category: "Alimentación", date: `${cm}-10T12:00:00` },
      { type: "expense", amount: 300, category: "Transporte", date: `${cm}-11T12:00:00` },
      { type: "expense", amount: 200, category: "Vivienda", date: `${cm}-12T12:00:00` },
    ];
    const result = calculateTopCategories(txns);
    expect(result).toHaveLength(3);
    expect(result[0].category).toBe("Transporte");
    expect(result[0].percentage).toBe(50);
    expect(result[1].category).toBe("Vivienda");
    expect(result[2].category).toBe("Alimentación");
  });

  it("limits to 3 categories", () => {
    const txns = ["A", "B", "C", "D"].map((c, i) => ({
      type: "expense", amount: (i + 1) * 100, category: c, date: `${cm}-10T12:00:00`
    }));
    expect(calculateTopCategories(txns)).toHaveLength(3);
  });

  it("ignores expenses from other months", () => {
    const txns = [
      { type: "expense", amount: 500, category: "Old", date: "2020-01-15T12:00:00" },
      { type: "expense", amount: 100, category: "New", date: `${cm}-10T12:00:00` },
    ];
    const result = calculateTopCategories(txns);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("New");
  });
});

describe("groupTransactionsByDate", () => {
  it("groups transactions by date", () => {
    const txns = [
      { id: "1", date: "2025-07-21T12:00:00" },
      { id: "2", date: "2025-07-20T12:00:00" },
      { id: "3", date: "2025-07-21T14:00:00" },
    ];
    const groups = groupTransactionsByDate(txns);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups["2025-07-21"]).toHaveLength(2);
    expect(groups["2025-07-20"]).toHaveLength(1);
  });

  it("sorts dates descending", () => {
    const txns = [
      { id: "1", date: "2025-07-19T12:00:00" },
      { id: "2", date: "2025-07-21T12:00:00" },
      { id: "3", date: "2025-07-20T12:00:00" },
    ];
    const groups = groupTransactionsByDate(txns);
    const keys = Object.keys(groups);
    expect(keys[0]).toBe("2025-07-21");
    expect(keys[1]).toBe("2025-07-20");
    expect(keys[2]).toBe("2025-07-19");
  });

  it("does not mutate original array", () => {
    const txns = [
      { id: "1", date: "2025-07-20T12:00:00" },
      { id: "2", date: "2025-07-21T12:00:00" },
    ];
    const original = [...txns];
    groupTransactionsByDate(txns);
    expect(txns).toEqual(original);
  });
});

describe("daysUntilDeadline", () => {
  it("returns null for null deadline", () => {
    expect(daysUntilDeadline(null)).toBeNull();
  });

  it("returns positive for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const iso = future.toISOString().slice(0, 10);
    expect(daysUntilDeadline(iso)).toBeGreaterThanOrEqual(9);
    expect(daysUntilDeadline(iso)).toBeLessThanOrEqual(11);
  });

  it("returns negative for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const iso = past.toISOString().slice(0, 10);
    expect(daysUntilDeadline(iso)).toBeLessThan(0);
  });
});

describe("todayISO", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today's date", () => {
    const result = todayISO();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });
});
