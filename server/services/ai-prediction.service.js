const { env } = require('../config/env');

const REQUEST_TIMEOUT_MS = 1500;
const ASSUMED_SEARCH_RADIUS_KM = 50; // same fixed benchmark ml/generate_training_data.py trains against
const RESPONSE_SPEED_BENCHMARK_HOURS = 24;
const ELIGIBILITY_WINDOW_DAYS = 90;

// Logged once per server run, not per request, so a down ML service doesn't
// spam the log on every search.
let hasLoggedMlUse = false;
let hasLoggedFallback = false;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// The exact formula this whole thing started as, kept here as the safety net
// for when ml/app.py (the real trained XGBoost model) is unreachable. Never
// let an optional local service being down break donor search.
function fallbackProbability({ daysSinceLastDonation, pastResponseRate, avgResponseTimeHours, distanceKm }) {
  const responseSpeed = clamp01(1 - avgResponseTimeHours / RESPONSE_SPEED_BENCHMARK_HOURS);
  const distanceFactor = clamp01(1 - distanceKm / ASSUMED_SEARCH_RADIUS_KM);
  const recency = clamp01(daysSinceLastDonation / ELIGIBILITY_WINDOW_DAYS);
  return clamp01(0.35 * pastResponseRate + 0.25 * responseSpeed + 0.2 * distanceFactor + 0.2 * recency);
}

// features: array of { daysSinceLastDonation, pastResponseRate, avgResponseTimeHours, distanceKm }
// (raw domain values, not pre-normalized). Returns a same-length/order array
// of probabilities (0-1) -- from the real trained model when ml/app.py
// (see ml/README or the Round 5 plan) is up, otherwise the hand-tuned formula.
async function predictBatch(features) {
  if (!features.length) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${env.ml.serviceUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donors: features.map((feature) => ({
          daysSinceLastDonation: feature.daysSinceLastDonation,
          pastResponseRate: feature.pastResponseRate,
          avgResponseTimeHours: feature.avgResponseTimeHours,
          distanceKm: feature.distanceKm,
        })),
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`ML service responded with status ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.probabilities) || data.probabilities.length !== features.length) {
      throw new Error('ML service returned an unexpected shape');
    }

    if (!hasLoggedMlUse) {
      console.log('[ai-prediction] Using the trained ML service for availability predictions.');
      hasLoggedMlUse = true;
    }
    return data.probabilities.map(clamp01);
  } catch (error) {
    if (!hasLoggedFallback) {
      console.warn(
        `[ai-prediction] ML service unavailable (${error.message}) -- falling back to the heuristic formula.`
      );
      hasLoggedFallback = true;
    }
    return features.map(fallbackProbability);
  }
}

module.exports = { predictBatch };
