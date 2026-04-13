import { BaseResource } from "./base.js";

export class GearResource extends BaseResource {
  async list() {
    return this.http.requestJson("GET", "/athlete/{id}/gear", () =>
      this.api.GET("/api/v1/athlete/{id}/gear{ext}", {
        params: { path: { id: this.athleteId, ext: "" } },
      }),
    );
  }
}
