import {
  IntervalsClient,
  type RequestRetryMode,
  type ResultParseAs,
  type ResultRequestOptions,
} from "intervals-icu-api";
import * as v from "valibot";

const client = new IntervalsClient({ apiKey: "synthetic-key" });

async function compileTransportSurface(): Promise<void> {
  const json = await client.request<{ wire_key: number }>("/api/v1/custom", {
    method: "POST",
    json: { exactKey: true },
    retry: "idempotent",
  });
  if (json.ok) {
    const value: number = json.value.data.wire_key;
    const status: number = json.value.response.status;
    void [value, status];
  }

  const text = await client.request("/api/v1/custom", { parseAs: "text" });
  if (text.ok) {
    const value: string = text.value.data;
    void value;
  }

  const bytes = await client.request("/api/v1/custom", { parseAs: "arrayBuffer" });
  if (bytes.ok) {
    const value: ArrayBuffer = bytes.value.data;
    void value;
  }
}

const mode: RequestRetryMode = "never";
const options: ResultRequestOptions<unknown, "none"> = { parseAs: "none", retry: mode };
const jsonOptions: ResultRequestOptions<string> = { schema: v.string() };
declare const nonJsonParser: "text" | "none";
client.request<unknown, typeof nonJsonParser>("/api/v1/custom", { parseAs: nonJsonParser });
declare const parser: ResultParseAs;
client.request<unknown, ResultParseAs>("/api/v1/custom", { parseAs: parser });
// @ts-expect-error A non-JSON parser must be supplied at runtime when selected explicitly.
client.request<unknown, "text">("/api/v1/custom");
// @ts-expect-error Response schemas are only valid with JSON parsing.
const invalidTextSchema: ResultRequestOptions<unknown> = {
  parseAs: "text",
  schema: v.string(),
};
void [compileTransportSurface, options, jsonOptions, invalidTextSchema];
