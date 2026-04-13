import createClient from "openapi-fetch";
import type { paths } from "../generated/schema.js";
import type { HttpExecutor } from "../http.js";

export type ApiClient = ReturnType<typeof createClient<paths>>;

export class BaseResource {
  constructor(
    protected http: HttpExecutor,
    protected api: ApiClient,
    protected athleteId: string,
  ) {}
}
