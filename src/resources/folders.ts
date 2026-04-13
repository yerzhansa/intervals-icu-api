import { BaseResource } from "./base.js";

export class FoldersResource extends BaseResource {
  async list() {
    return this.http.requestJson("GET", "/athlete/{id}/folders", () =>
      this.api.GET("/api/v1/athlete/{id}/folders", {
        params: { path: { id: this.athleteId } },
      }),
    );
  }
}
