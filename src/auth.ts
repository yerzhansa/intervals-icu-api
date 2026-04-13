export interface ApiKeyAuth {
  type: "api-key";
  apiKey: string;
}

export interface BearerAuth {
  type: "bearer";
  token: string;
}

export type AuthConfig = ApiKeyAuth | BearerAuth;

export function createAuthHeaders(auth: AuthConfig): Record<string, string> {
  if (auth.type === "api-key") {
    const encoded = btoa(`API_KEY:${auth.apiKey}`);
    return { Authorization: `Basic ${encoded}` };
  }
  return { Authorization: `Bearer ${auth.token}` };
}
