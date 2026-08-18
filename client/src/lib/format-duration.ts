// Formats a duration in minutes as a short human string. Kept out of i18n
// (unlike most user-facing text in this app) because "42 min" / "3h 12m" is
// already a compact numeric format that reads fine machine-translated as
// plain text via the surrounding sentence, and hardcoding "min"/"h" avoids
// needing two more translation keys for a single KPI card.
export function formatDurationMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
