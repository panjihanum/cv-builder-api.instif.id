import { HttpError } from "@/lib/httpError.js";
import { duitkuProvider } from "@/services/payment/providers/duitku.js";
import { xenditProvider } from "@/services/payment/providers/xendit.js";
import type { PaymentProvider } from "@/services/payment/providers/types.js";

/**
 * Registry of all supported payment gateways. Add a new provider here and it is
 * immediately available to the dashboard selector, checkout, and the unified
 * webhook — no other wiring needed.
 */
export const paymentProviders: Record<string, PaymentProvider> = {
  [duitkuProvider.id]: duitkuProvider,
  [xenditProvider.id]: xenditProvider,
};

export function listProviderIds(): string[] {
  return Object.keys(paymentProviders);
}

export function listProviders(): { id: string; label: string }[] {
  return Object.values(paymentProviders).map((provider) => ({
    id: provider.id,
    label: provider.label,
  }));
}

export function getPaymentProvider(id: string): PaymentProvider {
  const provider = paymentProviders[id];
  if (!provider) {
    throw new HttpError(
      400,
      `Provider pembayaran tidak dikenal: ${id}. Pilih salah satu: ${listProviderIds().join(", ")}`
    );
  }
  return provider;
}
