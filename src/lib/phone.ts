export function normalizePhone(input: string): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return normalized.length >= 10 && normalized.length <= 15;
}
