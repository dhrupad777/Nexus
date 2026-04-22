import { FirebaseError } from "firebase/app";

const MAP: Record<string, string> = {
  "auth/invalid-email": "That email looks invalid.",
  "auth/user-not-found": "No account with that email.",
  "auth/wrong-password": "Wrong password.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account already exists for this email.",
  "auth/weak-password": "Password is too weak.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/popup-blocked": "Popup was blocked by the browser.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Network error — check your connection.",
};

export function authErrorToMessage(err: unknown): string {
  if (err instanceof FirebaseError) return MAP[err.code] ?? err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
