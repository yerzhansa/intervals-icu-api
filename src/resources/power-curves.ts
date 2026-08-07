import type { HttpExecutor } from "../http.js";
import type { operations } from "../generated/schema.js";
import type { Result } from "../result.js";
import type { AthletePowerCurveSet } from "../schemas/analytics.js";
import {
  ActivityAnalyticsResource,
  type ListAthletePowerCurvesOptions,
} from "./activity-analytics.js";
import { BaseResource, type ApiClient } from "./base.js";

/** @deprecated Prefer canonical {@link ListAthletePowerCurvesOptions}. */
export type PowerCurvesQueryWire = operations["listAthletePowerCurves"]["parameters"]["query"];

export class PowerCurvesResource extends BaseResource {
  private readonly analytics: ActivityAnalyticsResource;

  constructor(http: HttpExecutor, api: ApiClient, athleteId: string) {
    super(http, api, athleteId);
    this.analytics = new ActivityAnalyticsResource(http, api, athleteId);
  }

  /**
   * @deprecated Use `client.activities.listAthletePowerCurves(options)`.
   * The pre-0.3 return declaration described the wrong endpoint payload.
   */
  async get(query: PowerCurvesQueryWire): Promise<Result<AthletePowerCurveSet>>;
  async get(options: ListAthletePowerCurvesOptions): Promise<Result<AthletePowerCurveSet>>;
  async get(
    options: ListAthletePowerCurvesOptions | PowerCurvesQueryWire,
  ): Promise<Result<AthletePowerCurveSet>> {
    return this.analytics.listAthletePowerCurves(options);
  }
}
