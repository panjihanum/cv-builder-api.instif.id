export function normalizePhone(input: string): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return normalized.length >= 10 && normalized.length <= 15;
}
