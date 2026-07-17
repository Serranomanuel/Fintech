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
  return data.map((transaction) => ({ ...transaction, amount: Number(transaction.amount) }));
}

export async function addTransaction(transaction) {
  const { data, error } = await requireClient().from("transactions").insert(transaction).select("id, type, amount, category, description, date").single();
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
