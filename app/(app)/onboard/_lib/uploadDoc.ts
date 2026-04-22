"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import type { DocType, UploadedDoc } from "./types";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — matches storage.rules

/**
 * Upload one document photo to orgs/{uid}/govtDocs/{docType}-{timestamp}.{ext}
 * and return the public download URL + storage path.
 *
 * Requires storage.rules to allow self-upload when orgId == request.auth.uid
 * (parallel to the firestore self-create branch).
 */
export async function uploadDocPhoto(uid: string, docType: DocType, file: File): Promise<UploadedDoc> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
  }
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !file.type.includes("pdf")) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/").pop();
  const safeExt = (ext ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `orgs/${uid}/govtDocs/${docType}-${Date.now()}.${safeExt}`;
  const objRef = ref(storage, path);

  const snap = await uploadBytes(objRef, file, {
    contentType: file.type || "image/jpeg",
    customMetadata: { docType, uploadedFor: uid },
  });
  const fileUrl = await getDownloadURL(snap.ref);

  return {
    docType,
    fileUrl,
    storagePath: path,
    uploadedAt: Date.now(),
  };
}
