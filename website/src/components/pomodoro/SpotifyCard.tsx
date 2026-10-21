import { useState } from 'react';
import { Music } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n.tsx';
import { parseSpotify, type Prefs } from '@/lib/prefs';

interface SpotifyCardProps {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
}

export function SpotifyCard({ prefs, onChange }: SpotifyCardProps) {
  const { t } = useI18n();
  const [spotifyBad, setSpotifyBad] = useState(false);

  const setSpotify = (value: string) => {
    const path = value.trim() === '' ? '' : parseSpotify(value);
    setSpotifyBad(path === null);
    if (path !== null) onChange({ spotify: path });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <label htmlFor="pref-spotify" className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <Music className="size-3.5" aria-hidden="true" />
          {t('pref_spotify')}
        </label>
        <Input
          id="pref-spotify"
          key={prefs.spotify === '' ? 'empty' : 'set'}
          defaultValue={prefs.spotify && `https://open.spotify.com/${prefs.spotify}`}
          placeholder="https://open.spotify.com/playlist/…"
          onChange={(event) => setSpotify(event.target.value)}
        />
        <p className="text-xs text-text-secondary">
          {spotifyBad ? t('pref_spotify_bad') : t('pref_spotify_hint')}
        </p>
        {prefs.spotify && (
          <iframe
            title="Spotify"
            src={`https://open.spotify.com/embed/${prefs.spotify}`}
            height="152"
            loading="lazy"
            allow="encrypted-media"
            className="w-full rounded-xl border-0"
          />
        )}
      </CardContent>
    </Card>
  );
}
