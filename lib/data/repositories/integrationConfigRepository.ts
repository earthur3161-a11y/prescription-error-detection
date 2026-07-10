import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { EnforcementLevel, IntegrationConfig, InstitutionMode } from "../../types";

const CONFIG_ID = "local" as const;

function generateApiKey(prefix: string): string {
  return `${prefix}_${generateId("").slice(1)}`;
}

function defaultConfig(): IntegrationConfig {
  return {
    id: CONFIG_ID,
    mode: "standalone",
    enforcementLevel: "advisory",
    apiKeyLive: generateApiKey("mg_live"),
    apiKeySandbox: generateApiKey("mg_sandbox"),
    webhookUrl: null,
    lastSyncAt: null,
    errorLogs: [],
  };
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  await ensureSeeded();
  const existing = await db.integrationConfig.get(CONFIG_ID);
  if (existing) return existing;
  const created = defaultConfig();
  await db.integrationConfig.put(created);
  return created;
}

export async function updateIntegrationConfig(
  patch: Partial<Pick<IntegrationConfig, "mode" | "enforcementLevel" | "webhookUrl">>
): Promise<IntegrationConfig> {
  await ensureSeeded();
  const current = await getIntegrationConfig();
  const updated: IntegrationConfig = { ...current, ...patch };
  await db.integrationConfig.put(updated);
  return updated;
}

export async function regenerateApiKey(kind: "live" | "sandbox"): Promise<IntegrationConfig> {
  await ensureSeeded();
  const current = await getIntegrationConfig();
  const updated: IntegrationConfig = {
    ...current,
    ...(kind === "live"
      ? { apiKeyLive: generateApiKey("mg_live") }
      : { apiKeySandbox: generateApiKey("mg_sandbox") }),
  };
  await db.integrationConfig.put(updated);
  return updated;
}

export async function recordSync(): Promise<IntegrationConfig> {
  await ensureSeeded();
  const current = await getIntegrationConfig();
  const updated: IntegrationConfig = { ...current, lastSyncAt: new Date().toISOString() };
  await db.integrationConfig.put(updated);
  return updated;
}

export async function appendErrorLog(message: string): Promise<IntegrationConfig> {
  await ensureSeeded();
  const current = await getIntegrationConfig();
  const updated: IntegrationConfig = {
    ...current,
    errorLogs: [
      { id: generateId("err"), timestamp: new Date().toISOString(), message },
      ...current.errorLogs,
    ].slice(0, 50),
  };
  await db.integrationConfig.put(updated);
  return updated;
}

export type { EnforcementLevel, InstitutionMode };
