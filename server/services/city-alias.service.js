// Known city renames/alternate spellings, so donor matching, search, and
// admin stats all treat them as the same place instead of splitting a city's
// donor pool across its old and new names. Deliberately a short, curated list
// of well-known Indian city renames -- not a general fuzzy-matching system.
// Add to this list as new mismatches turn up; anything not listed here just
// passes through unchanged.
const CITY_GROUPS = [
  { canonical: 'Bengaluru', aliases: ['bangalore'] },
  { canonical: 'Mumbai', aliases: ['bombay'] },
  { canonical: 'Kolkata', aliases: ['calcutta'] },
  { canonical: 'Chennai', aliases: ['madras'] },
  { canonical: 'Thiruvananthapuram', aliases: ['trivandrum'] },
  { canonical: 'Kochi', aliases: ['cochin'] },
  { canonical: 'Mysuru', aliases: ['mysore'] },
  { canonical: 'Puducherry', aliases: ['pondicherry'] },
  { canonical: 'Vadodara', aliases: ['baroda'] },
  { canonical: 'Gurugram', aliases: ['gurgaon'] },
  { canonical: 'Prayagraj', aliases: ['allahabad'] },
];

const CANONICAL_NAMES = new Set(CITY_GROUPS.map((group) => group.canonical));

const ALIAS_LOOKUP = new Map();
for (const { canonical, aliases } of CITY_GROUPS) {
  ALIAS_LOOKUP.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(alias.toLowerCase(), canonical);
  }
}

// Case/whitespace-insensitive, and collapses known alternate city names onto
// one canonical spelling. Returns that canonical spelling for a recognized
// city, or the lowercased/trimmed input unchanged for anything else -- either
// way, two names for the same place always normalize to the same string, and
// checking `CANONICAL_NAMES.has(result)` tells you whether it's a known city.
function normalizeCity(city) {
  if (!city) return '';
  const trimmed = String(city).trim().toLowerCase();
  return ALIAS_LOOKUP.get(trimmed) ?? trimmed;
}

function sameCity(a, b) {
  const normalizedA = normalizeCity(a);
  const normalizedB = normalizeCity(b);
  return Boolean(normalizedA) && Boolean(normalizedB) && normalizedA === normalizedB;
}

module.exports = { normalizeCity, sameCity, CANONICAL_NAMES };
