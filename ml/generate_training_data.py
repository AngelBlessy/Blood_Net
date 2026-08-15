"""
Synthetic training data generator for the donor-availability-prediction model.

WHY SYNTHETIC DATA: this is a real, standard ML mitigation for the "cold start"
problem, not a shortcut being hidden. BloodNet is a brand-new platform with no
real historical donor-response volume yet to train a classifier on. Rather than
fabricate a *fake* result (e.g. hand-picking weights and calling it "trained"),
this script generates a dataset with genuine statistical structure: features are
drawn from realistic distributions, and the label is produced by a generative
probability function *plus injected noise*, then Bernoulli-sampled. That noise is
what makes this an actual learning problem instead of a circular restatement of a
formula — the trained model has to recover an approximate signal from uncertain
data, exactly like it would from real usage data later. Once BloodNet has enough
real DonorResponse history, this generator is simply swapped out for a real
historical-data export and nothing else in the pipeline changes.

Only the 4 features Feature 7 of the spec names are used:
  - days_since_last_donation
  - past_response_rate
  - avg_response_time_hours
  - distance_km

Label: responded (1 = donor accepted the alert, 0 = declined/ignored).
"""

import numpy as np
import pandas as pd
import os

SEED = 42
N_SAMPLES = 5000
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "data", "training_data.csv")

# Benchmarks reused from the app's own conventions (see
# server/services/priority-score.service.js) so the synthetic feature ranges
# stay consistent with what the rest of BloodNet already treats as "typical."
ELIGIBILITY_WINDOW_DAYS = 90
RESPONSE_SPEED_BENCHMARK_HOURS = 24
ASSUMED_SEARCH_RADIUS_KM = 50


def generate(n=N_SAMPLES, seed=SEED):
    rng = np.random.default_rng(seed)

    # --- days_since_last_donation ---
    # ~20% of donors have never donated (treated as fully rested/available,
    # sampled as a large-but-varied value so it's not a single constant the
    # model could trivially memorize). The rest have a donation history spread
    # across and beyond the 90-day eligibility window.
    never_donated = rng.random(n) < 0.20
    days_since_last_donation = np.where(
        never_donated,
        rng.uniform(200, 400, n),
        rng.uniform(0, 200, n),
    )

    # --- past_response_rate ---
    # ~15% of donors have no alert history at all -> neutral 0.5 (matches the
    # app's own "no data yet" default). The rest follow a Beta distribution
    # skewed slightly below 0.5 -- most donors don't accept every alert they
    # get, a smaller group are consistently reliable.
    no_history = rng.random(n) < 0.15
    past_response_rate = np.where(
        no_history,
        0.5,
        rng.beta(2, 3, n),
    )

    # --- avg_response_time_hours ---
    # No-history donors get the app's neutral benchmark (24h). Everyone else
    # follows a right-skewed Gamma distribution (most reply within a handful
    # of hours, a long tail replies slowly), clipped to a plausible max.
    avg_response_time_hours = np.where(
        no_history,
        float(RESPONSE_SPEED_BENCHMARK_HOURS),
        np.clip(rng.gamma(shape=2.0, scale=6.0, size=n), 0.1, 72),
    )

    # --- distance_km ---
    # Exponential-ish spread: most matched donors are relatively close (search
    # results skew nearby), with a long tail out to ~100km.
    distance_km = np.clip(rng.exponential(scale=18, size=n), 0.2, 100)

    # --- Generative probability model (independent of the app's hand-tuned
    # weights on purpose -- these coefficients were chosen fresh for the
    # simulation, not copied from priority-score.service.js) ---
    norm_recency = np.minimum(days_since_last_donation / ELIGIBILITY_WINDOW_DAYS, 1.0)
    norm_distance = 1.0 - np.minimum(distance_km / ASSUMED_SEARCH_RADIUS_KM, 1.0)
    norm_speed = 1.0 - np.minimum(avg_response_time_hours / RESPONSE_SPEED_BENCHMARK_HOURS, 1.0)

    logit = (
        -8.25
        + 5.25 * past_response_rate
        + 3.5 * norm_speed
        + 2.75 * norm_distance
        + 2.5 * norm_recency
        + 1.5 * (past_response_rate * norm_speed)  # reliable AND fast responders skew even likelier
        + rng.normal(0, 0.3, n)  # irreducible noise -- real donor behavior isn't fully predictable
    )
    p_true = 1.0 / (1.0 + np.exp(-logit))
    responded = rng.binomial(1, p_true)

    return pd.DataFrame(
        {
            "days_since_last_donation": days_since_last_donation.round(1),
            "past_response_rate": past_response_rate.round(3),
            "avg_response_time_hours": avg_response_time_hours.round(2),
            "distance_km": distance_km.round(2),
            "responded": responded,
        }
    )


if __name__ == "__main__":
    df = generate()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df)} rows to {OUTPUT_PATH}")
    print(f"Positive rate (responded=1): {df['responded'].mean():.3f}")
    print(df.describe())
