import * as admin from "firebase-admin";

function deriveStatus(quantity: number, reservedQuantity: number): "AVAILABLE" | "RESERVED" | "DEPLETED" {
  if (reservedQuantity >= quantity) {
    return "DEPLETED";
  }
  if (reservedQuantity > 0) {
    // If you want partial reservations to be "RESERVED", you could return "RESERVED" here.
    // However, Flow A matching requires "AVAILABLE" to match. So if partial is allowed:
    return "AVAILABLE";
  }
  return "AVAILABLE";
}

export async function reserveInventory(tx: admin.firestore.Transaction, resourceId: string, quantity: number) {
  const db = admin.firestore();
  const ref = db.collection("resources").doc(resourceId);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new Error("Resource not found");
  const data = snap.data()!;
  
  const currentReserved = Number(data.reservedQuantity || 0);
  const newReserved = currentReserved + quantity;
  const total = Number(data.quantity || 0);
  
  if (newReserved > total) {
    throw new Error(`Cannot reserve ${quantity}; only ${total - currentReserved} available.`);
  }
  
  tx.update(ref, {
    reservedQuantity: newReserved,
    status: deriveStatus(total, newReserved)
  });
}

export async function commitInventory(tx: admin.firestore.Transaction, resourceId: string, quantity: number) {
  const db = admin.firestore();
  const ref = db.collection("resources").doc(resourceId);
  const snap = await tx.get(ref);
  if (!snap.exists) return;
  const data = snap.data()!;
  
  const currentQty = Number(data.quantity || 0);
  const currentReserved = Number(data.reservedQuantity || 0);
  
  const newQty = Math.max(0, currentQty - quantity);
  const newReserved = Math.max(0, currentReserved - quantity);
  
  tx.update(ref, {
    quantity: newQty,
    reservedQuantity: newReserved,
    status: deriveStatus(newQty, newReserved)
  });
}

export async function refundInventory(tx: admin.firestore.Transaction, resourceId: string, quantity: number) {
  const db = admin.firestore();
  const ref = db.collection("resources").doc(resourceId);
  const snap = await tx.get(ref);
  if (!snap.exists) return;
  const data = snap.data()!;
  
  const currentQty = Number(data.quantity || 0);
  const currentReserved = Number(data.reservedQuantity || 0);
  
  const newReserved = Math.max(0, currentReserved - quantity);
  
  tx.update(ref, {
    reservedQuantity: newReserved,
    status: deriveStatus(currentQty, newReserved)
  });
}
