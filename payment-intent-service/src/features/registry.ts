import type { PaymentFeatureHandler } from "./types.js";

const byKind = new Map<string, PaymentFeatureHandler>();

export function registerFeatureHandler(handler: PaymentFeatureHandler): void {
  if (byKind.has(handler.kind)) {
    throw new Error(`Duplicate payment feature kind: ${handler.kind}`);
  }
  byKind.set(handler.kind, handler);
}

export function getFeatureHandler(kind: string): PaymentFeatureHandler | undefined {
  return byKind.get(kind);
}

export function listRegisteredFeatureKinds(): string[] {
  return [...byKind.keys()].sort();
}
