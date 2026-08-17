import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_FORM,
  googleFormConfigured,
  googleFormFields,
  hasRequestedAccess,
  looksLikeEmail,
  submitWaitlist,
  waitlistEndpoint,
} from "./waitlist";

// Minimal in-memory globals so the browser-facing module runs in node (no jsdom).
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const g = globalThis as unknown as { localStorage: Storage; location: { search: string } };
g.localStorage = new MemStore() as unknown as Storage;
g.location = { search: "" };

function setSearch(search: string) {
  g.location.search = search;
}

describe("looksLikeEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(looksLikeEmail("jay@example.com")).toBe(true);
    expect(looksLikeEmail("  a.b+tag@sub.domain.co ")).toBe(true);
  });
  it("rejects malformed input", () => {
    for (const bad of ["", "nope", "a@b", "a@b.", "@x.com", "a b@x.com"]) {
      expect(looksLikeEmail(bad)).toBe(false);
    }
  });
});

describe("waitlistEndpoint", () => {
  beforeEach(() => {
    g.localStorage.clear();
    setSearch("");
  });

  it("is null with no config", () => {
    expect(waitlistEndpoint()).toBeNull();
  });

  it("reads and persists a ?waitlist= URL param", () => {
    setSearch("?waitlist=https://forms.example/abc");
    expect(waitlistEndpoint()).toBe("https://forms.example/abc");
    // persisted so later reads (without the param) still resolve it
    setSearch("");
    expect(waitlistEndpoint()).toBe("https://forms.example/abc");
  });
});

describe("submitWaitlist", () => {
  beforeEach(() => {
    g.localStorage.clear();
    setSearch("");
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an invalid email without any network call", async () => {
    const res = await submitWaitlist("nope", "All of it");
    expect(res.ok).toBe(false);
    expect(hasRequestedAccess()).toBe(false);
  });

  it("captures locally and marks requested when no endpoint is set", async () => {
    const res = await submitWaitlist("jay@example.com", "The voice squawk that calls me");
    expect(res.ok).toBe(true);
    expect(res.local).toBe(true);
    expect(hasRequestedAccess()).toBe(true);
  });

  it("POSTs JSON to the configured endpoint on success", async () => {
    setSearch("?waitlist=https://forms.example/abc");
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitWaitlist("jay@example.com", "Licensed real-time data");
    expect(res.ok).toBe(true);
    expect(res.local).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://forms.example/abc");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ email: "jay@example.com", tier: "Bramwell Concierge" });
  });

  it("reports failure when the endpoint returns an error", async () => {
    setSearch("?waitlist=https://forms.example/abc");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    const res = await submitWaitlist("jay@example.com", "All of it");
    expect(res.ok).toBe(false);
    expect(hasRequestedAccess()).toBe(false);
  });
});

describe("Google Form target", () => {
  const origEmail = GOOGLE_FORM.emailField;
  const origInterest = GOOGLE_FORM.interestField;
  afterEach(() => {
    GOOGLE_FORM.emailField = origEmail;
    GOOGLE_FORM.interestField = origInterest;
  });

  it("is not configured until an entry.<id> email field is set", () => {
    GOOGLE_FORM.emailField = "";
    expect(googleFormConfigured()).toBe(false);
    GOOGLE_FORM.emailField = "entry.111";
    expect(googleFormConfigured()).toBe(true);
  });

  it("action points at /formResponse, not /viewform", () => {
    expect(GOOGLE_FORM.action).toContain("/formResponse");
    expect(GOOGLE_FORM.action).not.toContain("/viewform");
  });

  it("maps only the configured fields to entry ids", () => {
    GOOGLE_FORM.emailField = "entry.111";
    GOOGLE_FORM.interestField = "entry.222";
    expect(googleFormFields("jay@example.com", "All of it")).toEqual({
      "entry.111": "jay@example.com",
      "entry.222": "All of it",
    });

    GOOGLE_FORM.interestField = ""; // interest optional / not present on the form
    expect(googleFormFields("jay@example.com", "All of it")).toEqual({
      "entry.111": "jay@example.com",
    });
  });
});
