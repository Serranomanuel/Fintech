const DEFAULT_CURRENCY = "COP";

let state = {
  activeUser: null,
  transactions: [],
  debts: [],
  savingsPlans: [],
  budgets: [],
  currentCurrency: DEFAULT_CURRENCY,
  authMode: "signin",
  activePeriod: "month",
  currentView: "home",
  showAllTransactions: false,
  selectedDebtId: null,
  selectedSavingsId: null,
  isLoading: false,
  darkMode: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
};

let listeners = [];

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

export function onStateChange(fn) {
  listeners.push(fn);
}

export function resetState() {
  state = {
    ...state,
    activeUser: null,
    transactions: [],
    debts: [],
    savingsPlans: [],
    budgets: [],
    currentCurrency: DEFAULT_CURRENCY,
    isLoading: false,
  };
}
