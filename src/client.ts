import createClient from "openapi-fetch";
import type { paths } from "./generated/schema.js";
import { createAuthHeaders, type AuthConfig } from "./auth.js";
import { RateLimiter, type RateLimiterOptions } from "./rate-limiter.js";
import { HttpExecutor } from "./http.js";
import { DEFAULT_RETRY, type RetryOptions } from "./retry.js";
import type { Hooks } from "./hooks.js";
import { AthleteResource } from "./resources/athlete.js";
import { ActivitiesResource } from "./resources/activities.js";
import { WellnessResource } from "./resources/wellness.js";
import { EventsResource } from "./resources/events.js";
import { WorkoutsResource } from "./resources/workouts.js";
import { PowerCurvesResource } from "./resources/power-curves.js";
import { FoldersResource } from "./resources/folders.js";
import { GearResource } from "./resources/gear.js";

const BASE_URL = "https://intervals.icu";

export interface IntervalsClientOptions {
  apiKey?: string;
  bearerToken?: string;
  athleteId?: string;
  baseUrl?: string;
  rateLimit?: Partial<RateLimiterOptions>;
  retry?: Partial<RetryOptions>;
  hooks?: Hooks;
  fetch?: typeof globalThis.fetch;
}

export class IntervalsClient {
  readonly athleteId: string;
  readonly athlete: AthleteResource;
  readonly activities: ActivitiesResource;
  readonly wellness: WellnessResource;
  readonly events: EventsResource;
  readonly workouts: WorkoutsResource;
  readonly powerCurves: PowerCurvesResource;
  readonly folders: FoldersResource;
  readonly gear: GearResource;

  private readonly api: ReturnType<typeof createClient<paths>>;

  constructor(options: IntervalsClientOptions) {
    const auth = resolveAuth(options);
    const baseUrl = options.baseUrl ?? BASE_URL;
    this.athleteId = options.athleteId ?? "0";

    this.api = createClient<paths>({
      baseUrl,
      headers: createAuthHeaders(auth),
      fetch: options.fetch,
    });

    const http = new HttpExecutor({
      rateLimiter: new RateLimiter(options.rateLimit),
      retryOpts: { ...DEFAULT_RETRY, ...options.retry },
      hooks: options.hooks ?? {},
      baseUrl,
      auth,
      fetchImpl: options.fetch,
    });

    this.athlete = new AthleteResource(http, this.api, this.athleteId);
    this.activities = new ActivitiesResource(http, this.api, this.athleteId);
    this.wellness = new WellnessResource(http, this.api, this.athleteId);
    this.events = new EventsResource(http, this.api, this.athleteId);
    this.workouts = new WorkoutsResource(http, this.api, this.athleteId);
    this.powerCurves = new PowerCurvesResource(http, this.api, this.athleteId);
    this.folders = new FoldersResource(http, this.api, this.athleteId);
    this.gear = new GearResource(http, this.api, this.athleteId);
  }

  get raw() {
    return this.api;
  }
}

function resolveAuth(options: IntervalsClientOptions): AuthConfig {
  if (options.apiKey) return { type: "api-key", apiKey: options.apiKey };
  if (options.bearerToken) return { type: "bearer", token: options.bearerToken };
  throw new Error("Either apiKey or bearerToken must be provided");
}
