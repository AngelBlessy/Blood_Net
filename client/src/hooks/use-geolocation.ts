import { useState } from 'react';

interface Coordinates {
  lat: number;
  lng: number;
}

// Wraps the browser Geolocation API in a promise-based helper shared by
// registration and profile-edit forms. Never throws to the caller — an
// unsupported browser or a denied permission just resolves to null, since
// location is always optional (city text is the fallback).
export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestLocation(): Promise<Coordinates | null> {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Location is not supported by this browser.');
      return Promise.resolve(null);
    }

    setLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (geoError) => {
          setLoading(false);
          setError(geoError.message || 'Could not determine your location.');
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
      );
    });
  }

  return { requestLocation, loading, error };
}
