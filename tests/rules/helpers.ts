import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const PROJECT_ID = "nexus-rules-test";

export async function makeEnv(): Promise<RulesTestEnvironment> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [hostname, portStr] = host.split(":");
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: hostname,
      port: Number(portStr),
      rules: readFileSync(join(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
}

export const ORG_A = "org-a";
export const ORG_B = "org-b";
export const UID_A = "user-a";
export const UID_B = "user-b";
export const UID_ADMIN = "user-admin";

export function asOrgA(env: RulesTestEnvironment) {
  return env.authenticatedContext(UID_A, { role: "ORG_ADMIN", orgId: ORG_A }).firestore();
}
export function asOrgB(env: RulesTestEnvironment) {
  return env.authenticatedContext(UID_B, { role: "ORG_ADMIN", orgId: ORG_B }).firestore();
}
export function asAdmin(env: RulesTestEnvironment) {
  return env.authenticatedContext(UID_ADMIN, { role: "PLATFORM_ADMIN" }).firestore();
}
export function asAnon(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore();
}
