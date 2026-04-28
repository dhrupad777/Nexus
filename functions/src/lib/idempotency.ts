import * as admin from "firebase-admin";

export async function withIdempotency<T>(
  uid: string,
  requestId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const db = admin.firestore();
  const ref = db.collection("_idempotency").doc(`${uid}_${requestId}`);

  try {
    await ref.create({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "STARTED",
    });
  } catch (err: any) {
    if (err.code === 6) { // ALREADY_EXISTS
      throw new Error("Idempotent request already processed or in progress.");
    }
    throw err;
  }

  try {
    const result = await fn();
    await ref.update({ status: "COMPLETED" });
    return result;
  } catch (err) {
    await ref.update({ status: "FAILED" });
    throw err;
  }
}
