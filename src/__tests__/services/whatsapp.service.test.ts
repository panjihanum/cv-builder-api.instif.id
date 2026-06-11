import { describe, it, expect } from "vitest";
import * as whatsappService from "@/services/whatsapp.service.js";

describe("whatsapp.service formatPhoneToChatId", () => {
  it("mengubah prefix 0 menjadi 62", () => {
    expect(whatsappService.formatPhoneToChatId("08123456789")).toBe(
      "628123456789@c.us"
    );
  });

  it("membersihkan karakter non-digit", () => {
    expect(whatsappService.formatPhoneToChatId("+62 812-345-6789")).toBe(
      "628123456789@c.us"
    );
  });

  it("membiarkan nomor internasional tanpa prefix 0", () => {
    expect(whatsappService.formatPhoneToChatId("628999")).toBe("628999@c.us");
  });
});

describe("whatsapp.service sendMessage", () => {
  it("melempar 503 saat client belum terhubung", async () => {
    expect(whatsappService.getStatus()).toBe("DISCONNECTED");
    await expect(
      whatsappService.sendMessage("08123456789", "halo")
    ).rejects.toMatchObject({ status: 503 });
  });
});
