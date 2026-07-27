import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { BLOOD_GROUPS } from '@/lib/blood-compatibility';
import { useGeolocation } from '@/hooks/use-geolocation';
import { apiGet, apiErrorMessage } from '@/lib/api';
import type { BloodGroup } from '@/types/domain';

interface SearchResult {
  name: string;
  bloodGroup: BloodGroup;
  city: string | null;
  availabilityStatus: 'available' | 'unavailable';
  distanceKm: number | null;
  approxLocation: { lat: number; lng: number } | null;
}

const RADIUS_OPTIONS_KM = [10, 25, 50, 100];
// Generic India-wide fallback center for the map before any coordinates exist.
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

export function SearchPage() {
  const { t } = useTranslation();
  const { requestLocation, loading: locating } = useGeolocation();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUseLocation() {
    const location = await requestLocation();
    if (location) {
      setCoords(location);
      setCity('');
    }
  }

  async function handleSearch() {
    if (!bloodGroup) {
      toast.error(t('errBloodGroupRequired'));
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ bloodGroup });
      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lng', String(coords.lng));
        params.set('radiusKm', String(radiusKm));
      } else if (city.trim()) {
        params.set('city', city.trim());
      }
      const data = await apiGet<{ results: SearchResult[] }>(`/search/donors?${params.toString()}`);
      setResults(data.results);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errSomethingWentWrong')));
    } finally {
      setLoading(false);
    }
  }

  const mapCenter: [number, number] = coords ? [coords.lat, coords.lng] : DEFAULT_CENTER;
  const pins = (results ?? []).filter(
    (result): result is SearchResult & { approxLocation: { lat: number; lng: number } } => result.approxLocation !== null
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('searchEyebrow')} title={t('searchTitle')} description={t('searchDesc')} />

      <Card className="mt-6 gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Select value={bloodGroup} onValueChange={(value) => setBloodGroup(value as BloodGroup)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectBloodGroupPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(radiusKm)} onValueChange={(value) => setRadiusKm(Number(value))} disabled={!coords}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS_KM.map((km) => (
                <SelectItem key={km} value={String(km)}>
                  {t('withinKmLabel', { km })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder={t('cityPlaceholder')}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            disabled={Boolean(coords)}
          />

          <Button variant="outline" className="gap-1.5" onClick={handleUseLocation} disabled={locating}>
            <MapPin className="size-3.5" />
            {locating ? t('locatingEllipsis') : t('useMyLocationButton')}
          </Button>
        </div>

        <Button onClick={handleSearch} disabled={loading} className="sm:w-auto">
          {loading ? t('loadingEllipsis') : t('searchButton')}
        </Button>
      </Card>

      {results && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden p-0" style={{ height: 420 }}>
            <MapContainer center={mapCenter} zoom={coords ? 11 : 5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {pins.map((result, index) => (
                <CircleMarker
                  key={index}
                  center={[result.approxLocation.lat, result.approxLocation.lng]}
                  radius={8}
                  pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.8 }}
                >
                  <Popup>
                    {result.name} — {result.bloodGroup}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Card>

          <Card className="gap-3 p-6">
            <h3 className="font-semibold">{t('resultsCount', { count: results.length })}</h3>
            {results.length === 0 ? (
              <EmptyState>{t('noDonorsFound')}</EmptyState>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{result.name}</p>
                      <p className="text-xs text-muted-foreground">{result.city ?? t('unknownLocation')}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{result.bloodGroup}</Badge>
                      {result.distanceKm !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('distanceAwayLabel', { km: result.distanceKm })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
