import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server.js";
import { IntervalsClient } from "../src/index.js";

let client: IntervalsClient;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // Create client AFTER MSW patches fetch
  client = new IntervalsClient({ apiKey: "test-key" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---- Athlete ----

describe("Athlete", () => {
  it("fetches athlete with camelCase keys", async () => {
    const result = await client.athlete.get();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.icuFtp).toBe(280);
      expect(result.value.name).toBe("Test Rider");
      expect(result.value.icuRestingHr).toBe(48);
    }
  });

  it("fetches athlete profile", async () => {
    const result = await client.athlete.getProfile();
    expect(result.ok).toBe(true);
  });

  it("returns Unauthorized error", async () => {
    server.use(
      http.get("https://intervals.icu/api/v1/athlete/:id", () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );
    const result = await client.athlete.get();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("Unauthorized");
  });

  it("returns NotFound error", async () => {
    server.use(
      http.get("https://intervals.icu/api/v1/athlete/:id", () =>
        HttpResponse.json(null, { status: 404 }),
      ),
    );
    const result = await client.athlete.get();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("NotFound");
  });
});

// ---- Activities ----

describe("Activities", () => {
  it("lists with camelCase keys", async () => {
    const result = await client.activities.list({ oldest: "2026-04-01" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[0].startDateLocal).toBe("2026-04-13T07:30:00");
      expect(result.value[0].icuTrainingLoad).toBe(65);
    }
  });

  it("gets single activity", async () => {
    const result = await client.activities.get("i12345:1234567890");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Morning Endurance Ride");
      expect(result.value.icuWeightedAvgWatts).toBe(202);
    }
  });
});

// ---- Wellness ----

describe("Wellness", () => {
  it("lists wellness records", async () => {
    const result = await client.wellness.list({ oldest: "2026-04-11", newest: "2026-04-13" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[0].ctl).toBe(72.5);
    }
  });

  it("gets wellness by date", async () => {
    const result = await client.wellness.get("2026-04-13");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ctl).toBe(72.5);
      expect(result.value.atl).toBe(58.3);
      expect(result.value.weight).toBe(72.5);
    }
  });
});

// ---- Events ----

describe("Events", () => {
  it("lists with camelCase keys", async () => {
    const result = await client.events.list({ oldest: "2026-04-14" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[0].startDateLocal).toBe("2026-04-14T00:00:00");
      expect(result.value[0].icuTrainingLoad).toBe(85);
    }
  });

  it("gets single event", async () => {
    const result = await client.events.get(98765);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Sweet Spot 2x20");
      expect(result.value.category).toBe("WORKOUT");
    }
  });

  it("creates event", async () => {
    const result = await client.events.create({
      start_date_local: "2026-04-15T00:00:00",
      category: "WORKOUT",
      name: "Test Workout",
      type: "Ride",
    } as any);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Test Workout");
    }
  });
});

// ---- Files ----

describe("Files", () => {
  it("downloads FIT file as ArrayBuffer", async () => {
    const result = await client.activities.downloadFitFile("a123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.byteLength).toBe(4);
    }
  });

  it("handles download error", async () => {
    server.use(
      http.get("https://intervals.icu/api/v1/activity/:id/fit-file", () =>
        new HttpResponse(null, { status: 404 }),
      ),
    );
    const result = await client.activities.downloadFitFile("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("NotFound");
  });

  it("exports activities as CSV", async () => {
    server.use(
      http.get("https://intervals.icu/api/v1/athlete/:id/activities.csv*", () =>
        new HttpResponse("id,name,type\n1,Morning Ride,Ride\n", {
          headers: { "Content-Type": "text/csv" },
        }),
      ),
    );
    const result = await client.activities.exportCsv({ oldest: "2026-01-01" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("Morning Ride");
  });
});
