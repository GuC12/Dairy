export interface TrackSearchResult {
  artist: string;
  title: string;
  genre: string;
  previewUrl: string;
  trackUrl: string;
  artworkUrl: string;
  estimatedBpm: number;
  estimatedTonality: 'major' | 'minor';
  estimatedEnergy: number;
}

function inferMusicParams(genre: string): {
  bpm: number;
  tonality: 'major' | 'minor';
  energy: number;
} {
  const g = genre.toLowerCase();
  if (/(electronic|dance|house|techno|idm|drum|hip-hop|rap)/.test(g)) {
    return { bpm: 124, tonality: 'minor', energy: 0.82 };
  }
  if (/(rock|metal|punk|alternative)/.test(g)) {
    return { bpm: 118, tonality: 'minor', energy: 0.74 };
  }
  if (/(jazz|blues|soul|vocal|bossanova)/.test(g)) {
    return { bpm: 78, tonality: 'major', energy: 0.36 };
  }
  if (/(classical|ambient|soundtrack|instrumental|folk|acoustic)/.test(g)) {
    return { bpm: 72, tonality: 'minor', energy: 0.28 };
  }
  if (/(pop|indie|disco|funk)/.test(g)) {
    return { bpm: 106, tonality: 'major', energy: 0.6 };
  }
  return { bpm: 94, tonality: 'major', energy: 0.48 };
}

export async function searchTrackPreviews(
  query: string,
  limit = 6
): Promise<TrackSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      clean
    )}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        artistName?: string;
        trackName?: string;
        primaryGenreName?: string;
        previewUrl?: string;
        trackViewUrl?: string;
        artworkUrl100?: string;
      }>;
    };

    const items = data.results ?? [];
    return items
      .filter((item) => Boolean(item.previewUrl && item.trackName))
      .map((item) => {
        const genre = item.primaryGenreName ?? 'Music';
        const inferred = inferMusicParams(genre);
        return {
          artist: item.artistName ?? '',
          title: item.trackName ?? '',
          genre,
          previewUrl: item.previewUrl!,
          trackUrl: item.trackViewUrl ?? '',
          artworkUrl: item.artworkUrl100 ?? '',
          estimatedBpm: inferred.bpm,
          estimatedTonality: inferred.tonality,
          estimatedEnergy: inferred.energy,
        };
      });
  } catch {
    return [];
  }
}
