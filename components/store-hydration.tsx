"use client";

import { useEffect } from "react";
import { useLigaFi } from "@/lib/store";

/** Rehidrata o store do localStorage depois da montagem (skipHydration). */
export function StoreHydration() {
  useEffect(() => {
    useLigaFi.persist?.rehydrate();
  }, []);
  return null;
}
