import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto.js";

describe("lib/crypto", () => {
  it("melakukan round-trip encrypt lalu decrypt", () => {
    const plain = "rahasia-duitku-api-key-123";
    const cipher = encrypt(plain);
    expect(cipher).not.toContain(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("menghasilkan ciphertext berformat iv:tag:cipher base64", () => {
    const cipher = encrypt("data");
    const parts = cipher.split(":");
    expect(parts).toHaveLength(3);
    expect(Buffer.from(parts[0], "base64")).toHaveLength(12);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(16);
  });

  it("menghasilkan ciphertext berbeda untuk plaintext sama", () => {
    expect(encrypt("sama")).not.toBe(encrypt("sama"));
  });

  it("gagal decrypt saat ciphertext dimanipulasi", () => {
    const cipher = encrypt("data-asli");
    const [iv, tag, data] = cipher.split(":");
    const tamperedData = Buffer.from(data, "base64");
    tamperedData[0] = tamperedData[0] ^ 0xff;
    const tampered = [iv, tag, tamperedData.toString("base64")].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("gagal decrypt saat auth tag dimanipulasi", () => {
    const cipher = encrypt("data-asli");
    const [iv, tag, data] = cipher.split(":");
    const tamperedTag = Buffer.from(tag, "base64");
    tamperedTag[0] = tamperedTag[0] ^ 0xff;
    const tampered = [iv, tamperedTag.toString("base64"), data].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("gagal decrypt saat format tidak valid", () => {
    expect(() => decrypt("bukan-format-valid")).toThrow(
      "Format ciphertext tidak valid"
    );
  });
});
