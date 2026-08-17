import { describe, expect, it } from "vitest";
import { checkLogin, DEV_USER } from "./auth";

describe("checkLogin", () => {
  it("accepts the dev credentials", async () => {
    expect(await checkLogin("dev", "bramwell2026")).toBe(true);
  });

  it("is case-insensitive and trims the username", async () => {
    expect(await checkLogin("  DEV ", "bramwell2026")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await checkLogin("dev", "wrong")).toBe(false);
    expect(await checkLogin("dev", "")).toBe(false);
  });

  it("rejects an unknown username", async () => {
    expect(await checkLogin("admin", "bramwell2026")).toBe(false);
  });

  it("exposes the dev username", () => {
    expect(DEV_USER).toBe("dev");
  });
});
