import { supabase } from "../../supabase/client";
import type {
  CheckPaymentRow,
  InstitutionApiKeySuperadminRow,
  InstitutionRow,
  SelfCheckAccountRow,
  SubscriptionPaymentRow,
  SubscriptionRow,
  SuperadminAccountRow,
  SuperadminDispenseActivityRow,
  SuperadminOverrideActivityRow,
  SuperadminPatientCheckActivityRow,
  SuperadminPrescriptionActivityRow,
} from "../../supabase/types";

/**
 * Every fetcher here is superadmin-only under RLS/RPC — see
 * supabase/migrations/0009_superadmin_oversight.sql. None of them select any
 * clinical column (drugs, verdicts, allergies, override reasons): the
 * prescription/override/patient-check RPCs hard-code their column list at
 * the database layer specifically so no client-side change here could widen
 * that by accident.
 */

export async function listSuperadminAccounts(): Promise<SuperadminAccountRow[]> {
  const { data, error } = await supabase.rpc("get_superadmin_accounts");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminSelfCheckAccounts(): Promise<SelfCheckAccountRow[]> {
  const { data, error } = await supabase
    .from("self_check_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminSubscriptions(): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase.from("subscriptions").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminInstitutions(): Promise<InstitutionRow[]> {
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminApiKeyActivity(): Promise<InstitutionApiKeySuperadminRow[]> {
  const { data, error } = await supabase
    .from("institution_api_keys_superadmin")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminPrescriptionActivity(): Promise<SuperadminPrescriptionActivityRow[]> {
  const { data, error } = await supabase.rpc("get_superadmin_prescription_activity");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminOverrideActivity(): Promise<SuperadminOverrideActivityRow[]> {
  const { data, error } = await supabase.rpc("get_superadmin_override_activity");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminPatientCheckActivity(): Promise<SuperadminPatientCheckActivityRow[]> {
  const { data, error } = await supabase.rpc("get_superadmin_patient_check_activity");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminDispenseActivity(): Promise<SuperadminDispenseActivityRow[]> {
  const { data, error } = await supabase.rpc("get_superadmin_dispense_activity");
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminCheckPayments(): Promise<CheckPaymentRow[]> {
  const { data, error } = await supabase
    .from("check_payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSuperadminSubscriptionPayments(): Promise<SubscriptionPaymentRow[]> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
