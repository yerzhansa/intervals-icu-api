import { describe, it, expect } from "vitest";
import { IntervalsClient } from "../src/client.js";

describe("IntervalsClient", () => {
  it("throws if no auth provided", () => {
    expect(() => new IntervalsClient({})).toThrow("Either apiKey or bearerToken must be provided");
  });

  it('defaults athleteId to "0"', () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.athleteId).toBe("0");
  });

  it("uses provided athleteId", () => {
    const client = new IntervalsClient({ apiKey: "test", athleteId: "i12345" });
    expect(client.athleteId).toBe("i12345");
  });

  it("exposes raw api client", () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.raw).toBeDefined();
    expect(client.raw.GET).toBeTypeOf("function");
  });

  it("exposes resource groups", () => {
    const client = new IntervalsClient({ apiKey: "test" });
    expect(client.athlete).toBeDefined();
    expect(client.activities).toBeDefined();
    expect(client.wellness).toBeDefined();
    expect(client.events).toBeDefined();
    expect(client.workouts).toBeDefined();
    expect(client.powerCurves).toBeDefined();
    expect(client.folders).toBeDefined();
    expect(client.gear).toBeDefined();
  });

  it("accepts hooks option", () => {
    const client = new IntervalsClient({
      apiKey: "test",
      hooks: {
        onRequest: ({ method, path }) => console.log(method, path),
      },
    });
    expect(client).toBeDefined();
  });

  it("accepts retry option", () => {
    const client = new IntervalsClient({
      apiKey: "test",
      retry: { maxAttempts: 5, initialDelayMs: 500 },
    });
    expect(client).toBeDefined();
  });
});
