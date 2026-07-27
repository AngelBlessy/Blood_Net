const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Accepts either a GeoJSON Point ({coordinates: [lng, lat]}) or a plain
// {lat, lng} object for both arguments.
function extractLatLng(point) {
  if (!point) return null;
  if (Array.isArray(point.coordinates) && point.coordinates.length === 2) {
    const [lng, lat] = point.coordinates;
    return { lat, lng };
  }
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    return { lat: point.lat, lng: point.lng };
  }
  return null;
}

function haversineKm(pointA, pointB) {
  const a = extractLatLng(pointA);
  const b = extractLatLng(pointB);
  if (!a || !b) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function toGeoPoint({ lat, lng }) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

// Shared parsing for the optional city/lat/lng fields sent from registration
// and profile-edit forms. Never throws — missing/invalid location input just
// means the profile ends up without a location, not a request failure.
function parseLocationFromBody(body) {
  const city = typeof body?.city === 'string' ? body.city.trim() : '';
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const location = Number.isFinite(lat) && Number.isFinite(lng) ? toGeoPoint({ lat, lng }) : null;
  return { city: city || null, location };
}

// Offsets a point by up to ~maxOffsetKm in a random direction, for showing an
// approximate map pin without revealing a donor's precise location publicly.
function jitterPoint(point, maxOffsetKm = 0.3) {
  const latLng = extractLatLng(point);
  if (!latLng) return null;

  const angle = Math.random() * 2 * Math.PI;
  const distanceKm = Math.random() * maxOffsetKm;
  const dLat = (distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng = ((distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI)) / Math.cos(toRadians(latLng.lat));

  return {
    lat: latLng.lat + dLat * Math.cos(angle),
    lng: latLng.lng + dLng * Math.sin(angle),
  };
}

module.exports = { haversineKm, toGeoPoint, extractLatLng, parseLocationFromBody, jitterPoint };
