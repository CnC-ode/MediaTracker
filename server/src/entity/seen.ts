import { MediaType } from 'src/entity/mediaItem';

export type Seen = {
  id?: number;
  date?: number;
  mediaItemId: number;
  episodeId?: number;
  userId: number;
  duration?: number;
};

export type SeenExtended = Seen & {
  mediaType: MediaType;
  tmdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export const seenColumns = <const>[
  'date',
  'id',
  'mediaItemId',
  'episodeId',
  'userId',
  'duration',
];

export class SeenFilters {
  public static mediaItemSeenValue = (seen: Seen) => {
    return Boolean(!seen.episodeId);
  };

  public static episodeSeenValue = (seen: Seen) => {
    return Boolean(seen.episodeId);
  };
}
