import { Logger } from '@nestjs/common';

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
}

const logger = new Logger('GooglePlacesClient');

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
].join(',');

/** The only place that talks to Google Places. Uses the Places API (New) Text Search endpoint —
 * same on/off-adapter shape as the Instantly and Hunter adapters: this function is the sole call
 * site, so swapping API versions later touches nothing else. */
export async function searchBusinesses(query: string, maxResultCount: number): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set — cannot run discovery.');
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(maxResultCount, 20) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Places search failed: ${response.status} ${text}`);
  }

  const data = (await response.json().catch(() => ({}))) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      websiteUri?: string;
      rating?: number;
      userRatingCount?: number;
      primaryTypeDisplayName?: { text?: string };
    }>;
  };

  const places = data.places ?? [];
  logger.log(`[google-places] "${query}" -> ${places.length} results`);

  return places
    .filter((p): p is typeof p & { id: string; displayName: { text: string } } => Boolean(p.id && p.displayName?.text))
    .map((p) => ({
      placeId: p.id,
      name: p.displayName.text,
      category: p.primaryTypeDisplayName?.text ?? null,
      address: p.formattedAddress ?? null,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
    }));
}
