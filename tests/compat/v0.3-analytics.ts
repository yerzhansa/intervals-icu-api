import { IntervalsClient, type FindBestEffortsOptions } from "intervals-icu-api";

declare const client: IntervalsClient;

const durationWindow: FindBestEffortsOptions = { stream: "watts", duration: 300 };
const distanceWindow: FindBestEffortsOptions = { stream: "pace", distance: 5_000 };
const combinedWindow: FindBestEffortsOptions = {
  stream: "watts",
  duration: 300,
  distance: 5_000,
};

void client.activities.findBestEfforts("synthetic-activity", durationWindow);
void client.activities.findBestEfforts("synthetic-activity", distanceWindow);
void client.activities.findBestEfforts("synthetic-activity", combinedWindow);
// @ts-expect-error At least one of duration or distance is required.
void client.activities.findBestEfforts("synthetic-activity", { stream: "watts" });
