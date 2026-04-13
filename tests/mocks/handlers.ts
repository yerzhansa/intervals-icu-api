import { http, HttpResponse } from "msw";
import athleteFixture from "../fixtures/athlete.json";
import activitiesFixture from "../fixtures/activities-list.json";
import activityFixture from "../fixtures/activity.json";
import wellnessListFixture from "../fixtures/wellness-list.json";
import wellnessFixture from "../fixtures/wellness.json";
import eventsFixture from "../fixtures/events-list.json";
import eventFixture from "../fixtures/event.json";
import powerCurveFixture from "../fixtures/power-curve.json";

const BASE = "https://intervals.icu";

export const handlers = [
  // Athlete
  http.get(`${BASE}/api/v1/athlete/:id`, () => HttpResponse.json(athleteFixture)),
  http.get(`${BASE}/api/v1/athlete/:id/profile`, () => HttpResponse.json(athleteFixture)),

  // Activities
  http.get(`${BASE}/api/v1/athlete/:id/activities`, () => HttpResponse.json(activitiesFixture)),
  http.get(`${BASE}/api/v1/activity/:id`, () => HttpResponse.json(activityFixture)),

  // Wellness
  http.get(`${BASE}/api/v1/athlete/:id/wellness`, () => HttpResponse.json(wellnessListFixture)),
  http.get(`${BASE}/api/v1/athlete/:id/wellness/:date`, () => HttpResponse.json(wellnessFixture)),

  // Events
  http.get(`${BASE}/api/v1/athlete/:id/events`, () => HttpResponse.json(eventsFixture)),
  http.get(`${BASE}/api/v1/athlete/:id/events/:eventId`, () => HttpResponse.json(eventFixture)),
  http.post(`${BASE}/api/v1/athlete/:id/events`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 99999, category: "WORKOUT", start_date_local: "2026-04-14T00:00:00", ...body });
  }),

  // Power curves
  http.get(`${BASE}/api/v1/athlete/:id/power-curves`, () => HttpResponse.json(powerCurveFixture)),

  // File downloads
  http.get(`${BASE}/api/v1/activity/:id/fit-file`, () =>
    new HttpResponse(new Uint8Array([0x2e, 0x46, 0x49, 0x54]).buffer, {
      headers: { "Content-Type": "application/octet-stream" },
    }),
  ),
];
