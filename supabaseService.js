import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function requireClient() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

function throwIfError(error) {
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await requireClient().auth.getSession();
  throwIfError(error);
  return data.session;
}

export function onAuthStateChange(callback) {
  return requireClient().auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await requireClient().auth.signUp({ email, password });
  throwIfError(error);
  return data;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  throwIfError(error);
}

export async function fetchProfile(userId) {
  const { data, error } = await requireClient().from("profiles").select("preferred_currency").eq("id", userId).single();
  throwIfError(error);
  return data;
}

export async function fetchTransactions() {
  const { data, error } = await requireClient().from("transactions").select("id, type, amount, category, description, date").order("date", { ascending: false });
  throwIfError(error);
  return data.map((t) => ({ ...t, amount: Number(t.amount) }));
}

export async function addTransaction(transaction) {
  const { data, error } = await requireClient().from("transactions").insert(transaction).select("id, type, amount, category, description, date").single();
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function updateTransaction(id, updates) {
  const { data, error } = await requireClient().from("transactions").update(updates).eq("id", id).select("id, type, amount, category, description, date").single();
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function deleteTransaction(id) {
  const { error } = await requireClient().from("transactions").delete().eq("id", id);
  throwIfError(error);
}

export async function updateUserCurrency(currency) {
  const { error } = await requireClient().from("profiles").update({ preferred_currency: currency }).eq("id", (await getSession()).user.id);
  throwIfError(error);
}

export async function fetchDebts() {
  const { data, error } = await requireClient().from("debts").select("id, name, creditor, total_amount, remaining_amount, interest_rate, minimum_payment, due_day, start_date, status").order("created_at", { ascending: false });
  throwIfError(error);
  return data.map((d) => ({ ...d, total_amount: Number(d.total_amount), remaining_amount: Number(d.remaining_amount), interest_rate: Number(d.interest_rate), minimum_payment: Number(d.minimum_payment) }));
}

export async function addDebt(debt) {
  const { data, error } = await requireClient().from("debts").insert(debt).select("id, name, creditor, total_amount, remaining_amount, interest_rate, minimum_payment, due_day, start_date, status").single();
  throwIfError(error);
  return { ...data, total_amount: Number(data.total_amount), remaining_amount: Number(data.remaining_amount), interest_rate: Number(data.interest_rate), minimum_payment: Number(data.minimum_payment) };
}

export async function updateDebt(id, updates) {
  const { data, error } = await requireClient().from("debts").update(updates).eq("id", id).select("id, name, creditor, total_amount, remaining_amount, interest_rate, minimum_payment, due_day, start_date, status").single();
  throwIfError(error);
  return { ...data, total_amount: Number(data.total_amount), remaining_amount: Number(data.remaining_amount), interest_rate: Number(data.interest_rate), minimum_payment: Number(data.minimum_payment) };
}

export async function deleteDebt(id) {
  const { error } = await requireClient().from("debts").delete().eq("id", id);
  throwIfError(error);
}

export async function addDebtPayment(payment) {
  const { data, error } = await requireClient().from("debt_payments").insert(payment).select("id, debt_id, amount, note, payment_date").single();
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function fetchDebtPayments(debtId) {
  const { data, error } = await requireClient().from("debt_payments").select("id, debt_id, amount, note, payment_date").eq("debt_id", debtId).order("payment_date", { ascending: false });
  throwIfError(error);
  return data.map((p) => ({ ...p, amount: Number(p.amount) }));
}

export async function deleteDebtPayment(payment) {
  const { error } = await requireClient().from("debt_payments").delete().eq("id", payment.id);
  throwIfError(error);
}

export async function fetchSavingsPlans() {
  const { data, error } = await requireClient().from("savings_plans").select("id, name, target_amount, current_amount, deadline, months, color, status").order("created_at", { ascending: false });
  throwIfError(error);
  return data.map((p) => ({ ...p, target_amount: Number(p.target_amount), current_amount: Number(p.current_amount) }));
}

export async function addSavingsPlan(plan) {
  const { data, error } = await requireClient().from("savings_plans").insert(plan).select("id, name, target_amount, current_amount, deadline, months, color, status").single();
  throwIfError(error);
  return { ...data, target_amount: Number(data.target_amount), current_amount: Number(data.current_amount) };
}

export async function updateSavingsPlan(id, updates) {
  const { data, error } = await requireClient().from("savings_plans").update(updates).eq("id", id).select("id, name, target_amount, current_amount, deadline, months, color, status").single();
  throwIfError(error);
  return { ...data, target_amount: Number(data.target_amount), current_amount: Number(data.current_amount) };
}

export async function deleteSavingsPlan(id) {
  const { error } = await requireClient().from("savings_plans").delete().eq("id", id);
  throwIfError(error);
}

export async function addSavingsDeposit(deposit) {
  const { data, error } = await requireClient().from("savings_deposits").insert(deposit).select("id, plan_id, amount, note, deposit_date").single();
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function fetchSavingsDeposits(planId) {
  const { data, error } = await requireClient().from("savings_deposits").select("id, plan_id, amount, note, deposit_date").eq("plan_id", planId).order("deposit_date", { ascending: false });
  throwIfError(error);
  return data.map((d) => ({ ...d, amount: Number(d.amount) }));
}

export async function deleteSavingsDeposit(deposit) {
  const { error } = await requireClient().from("savings_deposits").delete().eq("id", deposit.id);
  throwIfError(error);
}

export async function fetchBudgets() {
  const { data, error } = await requireClient().from("budgets").select("id, category, monthly_limit").order("created_at", { ascending: false });
  throwIfError(error);
  return data.map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) }));
}

export async function upsertBudget(budget) {
  const { data, error } = await requireClient().from("budgets").upsert(budget, { onConflict: "user_id,category" }).select("id, category, monthly_limit").single();
  throwIfError(error);
  return { ...data, monthly_limit: Number(data.monthly_limit) };
}

export async function deleteBudget(id) {
  const { error } = await requireClient().from("budgets").delete().eq("id", id);
  throwIfError(error);
}
