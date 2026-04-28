import { HttpsError } from "firebase-functions/v2/https";

export function notImplemented(featureName: string): never {
  throw new HttpsError("unimplemented", `${featureName} is not implemented yet.`);
}
