import { describe, it, expect } from "vitest";
import {
  getPaymentProvider,
  listProviderIds,
  listProviders,
} from "@/services/payment/providers/index.js";

describe("payment provider registry", () => {
  it("mendaftarkan duitku dan xendit", () => {
    expect(listProviderIds()).toEqual(
      expect.arrayContaining(["duitku", "xendit"])
    );
  });

  it("mengembalikan id dan label untuk setiap provider", () => {
    expect(listProviders()).toEqual(
      expect.arrayContaining([
        { id: "duitku", label: "Duitku" },
        { id: "xendit", label: "Xendit" },
      ])
    );
  });

  it("mengambil provider berdasarkan id", () => {
    expect(getPaymentProvider("xendit").id).toBe("xendit");
  });

  it("melempar 400 untuk provider tidak dikenal", () => {
    expect(() => getPaymentProvider("midtrans")).toThrowError(
      expect.objectContaining({ status: 400 })
    );
  });
});
