import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.js";
import {
  createVerificationToken,
  consumeVerificationToken,
} from "@/lib/verification.js";

beforeEach(() => {
  vi.clearAllMocks();
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("createVerificationToken", () => {
  it("menyimpan hash (bukan token mentah), identifier lowercase, dan TTL ke depan", async () => {
    vi.mocked(db.verificationToken.create).mockResolvedValue({} as never);
    const before = Date.now();
    const token = await createVerificationToken("Budi@Instif.ID");

    expect(token).toBeTruthy();
    const args = vi.mocked(db.verificationToken.create).mock.calls[0][0];
    expect(args.data.identifier).toBe("budi@instif.id");
    expect(args.data.tokenHash).toBe(sha256(token));
    expect(args.data.tokenHash).not.toBe(token);
    expect(new Date(args.data.expiresAt).getTime()).toBeGreaterThan(before);
  });
});

describe("consumeVerificationToken", () => {
  it("mengembalikan invalid untuk token tidak dikenal", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null);
    expect(await consumeVerificationToken("nope")).toEqual({
      status: "invalid",
    });
    expect(db.verificationToken.update).not.toHaveBeenCalled();
  });

  it("mengembalikan invalid untuk token yang sudah dipakai", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: "t1",
      identifier: "a@b.com",
      consumed: true,
      expiresAt: new Date(Date.now() + 10_000),
    } as never);
    expect(await consumeVerificationToken("tok")).toEqual({
      status: "invalid",
    });
  });

  it("mengembalikan expired untuk token kedaluwarsa tanpa menandai consumed", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: "t1",
      identifier: "a@b.com",
      consumed: false,
      expiresAt: new Date(Date.now() - 10_000),
    } as never);
    expect(await consumeVerificationToken("tok")).toEqual({
      status: "expired",
    });
    expect(db.verificationToken.update).not.toHaveBeenCalled();
  });

  it("menandai consumed dan mengembalikan email untuk token valid", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: "t1",
      identifier: "budi@instif.id",
      consumed: false,
      expiresAt: new Date(Date.now() + 10_000),
    } as never);
    vi.mocked(db.verificationToken.update).mockResolvedValue({} as never);
    expect(await consumeVerificationToken("tok")).toEqual({
      status: "valid",
      email: "budi@instif.id",
    });
    expect(db.verificationToken.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { consumed: true },
    });
  });
});
