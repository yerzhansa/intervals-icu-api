import { IntervalsClient, decodeActivity, type Activity, type Result } from "intervals-icu-api";

const client = new IntervalsClient({
  apiKey: "synthetic-key",
  athleteId: "synthetic-athlete",
  retry: { maxAttempts: 1 },
});

function consume(..._values: unknown[]): void {}

async function representativeConsumer(): Promise<void> {
  const activities = await client.activities.list({ oldest: "2025-01-01" });
  if (activities.ok) {
    const activity: Activity | undefined = activities.value[0];
    consume(activity?.startDateLocal, activity?.icuTrainingLoad);
  }

  const streams = await client.activities.getStreams("synthetic-activity", [
    "time",
    "watts",
    "heartrate",
    "athlete_custom_channel",
  ]);
  if (streams.ok) {
    for (const stream of streams.value) {
      consume(stream.type, stream.data);
    }
  }

  const fit: Result<ArrayBuffer> = await client.activities.downloadFitFile("synthetic-activity");
  if (fit.ok) consume(fit.value.byteLength);

  const raw = await client.raw.GET("/api/v1/athlete/{id}", {
    params: { path: { id: "synthetic-athlete" } },
  });
  consume(raw.data?.icu_resting_hr);

  const decoded = decodeActivity({
    id: "synthetic-activity",
    start_date_local: "2025-01-01T08:00:00",
    type: "Run",
  });
  if (decoded.ok) consume(decoded.value.start_date_local);
}

void representativeConsumer;
