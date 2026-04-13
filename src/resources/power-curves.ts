import type { operations } from "../generated/schema.js";
import { PowerCurveSchema, type PowerCurve } from "../schemas/power-curve.js";
import type { Result } from "../result.js";
import { BaseResource } from "./base.js";

type PowerCurvesQuery = operations["listAthletePowerCurves"]["parameters"]["query"];

export class PowerCurvesResource extends BaseResource {
  async get(query: PowerCurvesQuery): Promise<Result<PowerCurve>> {
    return this.http.requestJson("GET", "/athlete/{id}/power-curves", () =>
      this.api.GET("/api/v1/athlete/{id}/power-curves{ext}", {
        params: { path: { id: this.athleteId, ext: "" }, query },
      }),
      PowerCurveSchema,
    );
  }
}
