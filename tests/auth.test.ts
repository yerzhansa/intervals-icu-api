import { describe, it, expect } from "vitest";
import { createAuthHeaders } from "../src/auth.js";

describe("createAuthHeaders", () => {
  it("creates Basic auth header from API key", () => {
    const headers = createAuthHeaders({ type: "api-key", apiKey: "test-key-123" });
    const decoded = atob(headers.Authorization.replace("Basic ", ""));
    expect(decoded).toBe("API_KEY:test-key-123");
  });

  it("creates Bearer auth header from token", () => {
    const headers = createAuthHeaders({ type: "bearer", token: "my-oauth-token" });
    expect(headers.Authorization).toBe("Bearer my-oauth-token");
  });
});
