import _ from 'lodash';
import { addHours, parseISO } from 'date-fns';

import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { TvEpisodeFilters } from 'src/entity/tvepisode';
import { tvEpisodeRepository } from 'src/repository/episode';
import { LastSeenAt, mediaItemRepository } from 'src/repository/mediaItem';
import { tvSeasonRepository } from 'src/repository/season';
import { seenRepository, Pagination } from 'src/repository/seen';
import { Seen, SeenExtended } from 'src/entity/seen';
import { logger } from 'src/logger';
import { listItemRepository } from 'src/repository/listItemRepository';
import { MediaType } from 'src/entity/mediaItem';
import { findMediaItemOrEpisodeByExternalId } from 'src/metadata/findByExternalId';
import { Database } from 'src/dbconfig';

/**
 * @openapi_tags Seen
 */
export class SeenController {
  /**
   * @openapi_operationId add
   */
  add = createExpressRoute<{
    method: 'put';
    path: '/api/seen';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
      lastSeenEpisodeId?: number;
      lastSeenAt?: LastSeenAt;
      date?: number;
      duration?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      mediaItemId,
      seasonId,
      episodeId,
      lastSeenAt,
      lastSeenEpisodeId,
      duration,
    } = req.query;

    let date = req.query.date ? new Date(req.query.date) : null;

    const mediaItem = await mediaItemRepository.findOne({
      id: mediaItemId,
    });

    if (!mediaItem) {
      res.sendStatus(400);
      return;
    }

    if (date && new Date(date) > addHours(new Date(), 1)) {
      res.sendStatus(400);
      logger.debug(
        `seen date (${new Date(
          date
        )}) is older then current date (${new Date()})`
      );
      return;
    }

    if (!date) {
      if (lastSeenAt === 'now') {
        date = new Date();
      } else if (lastSeenAt === 'unknown') {
        date = null;
      } else if (lastSeenAt === 'release_date') {
        if (episodeId) {
          const episode = await tvEpisodeRepository.findOne({
            id: episodeId,
          });

          date = parseISO(episode.releaseDate);
        } else if (seasonId) {
          const season = await tvSeasonRepository.findOne({
            id: seasonId,
          });
          date = parseISO(season.releaseDate);
        } else {
          const mediaItem = await mediaItemRepository.findOne({
            id: mediaItemId,
          });
          if (!mediaItem) {
            res.sendStatus(400);
            return;
          }
          date = parseISO(mediaItem.releaseDate);
        }
      }
    }

    if (lastSeenEpisodeId) {
      const episodes = await tvEpisodeRepository.find({
        tvShowId: mediaItemId,
        seasonId: seasonId || undefined,
      });

      const lastEpisode = episodes.find(
        (episode) => episode.id === lastSeenEpisodeId
      );

      if (!lastEpisode) {
        throw new Error(`No episode with id ${lastSeenEpisodeId}`);
      }

      const seenEpisodes = episodes
        .filter(TvEpisodeFilters.unwatchedEpisodes)
        .filter(TvEpisodeFilters.releasedEpisodes)
        .filter(TvEpisodeFilters.nonSpecialEpisodes)
        .filter(
          (episode) =>
            episode.seasonNumber < lastEpisode.seasonNumber ||
            (episode.seasonNumber === lastEpisode.seasonNumber &&
              episode.episodeNumber <= lastEpisode.episodeNumber)
        );

      await seenRepository.createMany(
        seenEpisodes.map((episode) => ({
          userId: userId,
          mediaItemId: mediaItemId,
          seasonId: episode.seasonId,
          episodeId: episode.id,
          date:
            lastSeenAt === 'release_date'
              ? parseISO(episode.releaseDate).getTime()
              : date?.getTime() || null,
          duration:
            episode.runtime * 60 * 1000 || mediaItem.runtime * 60 * 1000,
        }))
      );
    } else {
      const mediaItem = await mediaItemRepository.findOne({
        id: mediaItemId,
      });

      if (!mediaItem) {
        res.sendStatus(400);
        return;
      }

      if (episodeId) {
        const episode = await tvEpisodeRepository.findOne({
          id: episodeId,
        });

        if (!episode) {
          res.sendStatus(400);
          return;
        }

        await seenRepository.create({
          userId: userId,
          mediaItemId: mediaItemId,
          episodeId: episodeId,
          date: date?.getTime() || null,
        });
      } else if (seasonId) {
        const episodes = await tvEpisodeRepository.find({
          seasonId: seasonId,
        });

        await seenRepository.createMany(
          episodes
            .filter(TvEpisodeFilters.unwatchedEpisodes)
            .filter(TvEpisodeFilters.nonSpecialEpisodes)
            .filter(TvEpisodeFilters.releasedEpisodes)
            .map(
              (episode): Seen => ({
                userId: userId,
                mediaItemId: mediaItemId,
                episodeId: episode.id,
                date:
                  lastSeenAt === 'release_date'
                    ? parseISO(episode.releaseDate).getTime()
                    : date?.getTime() || null,
                duration:
                  episode.runtime * 60 * 1000 || mediaItem.runtime * 60 * 1000,
              })
            )
        );
      } else {
        if (mediaItem.mediaType === 'tv') {
          const episodes = await tvEpisodeRepository.find({
            tvShowId: mediaItemId,
          });

          await seenRepository.createMany(
            episodes
              .filter(TvEpisodeFilters.nonSpecialEpisodes)
              .filter(TvEpisodeFilters.releasedEpisodes)
              .map(
                (episode): Seen => ({
                  userId: userId,
                  mediaItemId: mediaItemId,
                  episodeId: episode.id,
                  date:
                    lastSeenAt === 'release_date'
                      ? parseISO(episode.releaseDate).getTime()
                      : date?.getTime() || null,
                  duration:
                    episode.runtime * 60 * 1000 ||
                    mediaItem.runtime * 60 * 1000,
                })
              )
          );
        } else {
          await seenRepository.create({
            userId: userId,
            mediaItemId: mediaItemId,
            episodeId: null,
            date: date?.getTime() || null,
            duration: duration || null,
          });
        }
      }

      if (mediaItem.mediaType !== 'tv') {
        await listItemRepository.removeItem({
          userId: userId,
          mediaItemId: mediaItemId,
          watchlist: true,
        });
      }
    }

    res.send();
  });

  /**
   * @openapi_operationId addByExternalId
   */
  addByExternalId = createExpressRoute<{
    method: 'put';
    path: '/api/seen/by-external-id';
    requestBody: {
      mediaType: MediaType;
      id: {
        imdbId?: string;
        tmdbId?: number;
      };
      seasonNumber?: number;
      episodeNumber?: number;
      duration?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { mediaType, id, seasonNumber, episodeNumber, duration } = req.body;

    const { mediaItem, episode, error } =
      await findMediaItemOrEpisodeByExternalId({
        mediaType: mediaType,
        id: id,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
      });

    if (error) {
      res.status(400);
      res.send(error);
      return;
    }

    await Database.knex.transaction(async (trx) => {
      const previousSeenItem = await trx<Seen>('seen')
        .where('userId', userId)
        .where('mediaItemId', mediaItem.id)
        .where('episodeId', episode?.id || null)
        .where('date', '>', Date.now() - 1000 * 60 * 60 * 12);

      if (previousSeenItem.length > 0) {
        logger.debug(
          `seen entry for userId ${userId}, mediaItemId: ${
            mediaItem.id
          }, episodeId: ${episode?.id} already exists, at ${new Date(
            previousSeenItem.at(0).date
          )}`
        );

        return;
      }

      logger.debug(
        `adding seen entry for userId ${userId}, mediaItemId: ${mediaItem.id}, episodeId: ${episode?.id}`
      );

      await trx<Seen>('seen').insert({
        userId: userId,
        mediaItemId: mediaItem.id,
        episodeId: episode?.id || null,
        date: Date.now(),
        duration: duration,
      });
    });

    res.send();
  });

  /**
   * @openapi_operationId deleteById
   */
  deleteById = createExpressRoute<{
    method: 'delete';
    path: '/api/seen/:seenId';
    pathParams: {
      seenId: number;
    };
  }>(async (req, res) => {
    const { seenId } = req.params;

    await seenRepository.delete({
      id: seenId,
    });

    res.send();
  });

  /**
   * @openapi_operationId delete
   */
  removeFromSeenHistory = createExpressRoute<{
    method: 'delete';
    path: '/api/seen/';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { mediaItemId, seasonId, episodeId } = req.query;

    if (episodeId) {
      await seenRepository.delete({
        userId: userId,
        episodeId: episodeId,
      });
    } else if (seasonId) {
      await seenRepository.deleteForTvSeason({
        userId: userId,
        seasonId: seasonId,
      });
    } else {
      await seenRepository.delete({
        userId: userId,
        mediaItemId: mediaItemId,
      });
    }

    res.send();
  });

    /**
     * @description Get all seen items
     * @openapi_operationId get
     */
    get = createExpressRoute<{
      method: 'get';
      path: '/api/seen';
      /**
       * @description List of seen items
       */
      requestQuery: {
        page?: number;
        limit?: number;
        extended?: boolean;
        mediaType?: MediaType;
        tmdbId?: number;
        seasonNumber?: number;
        episodeNumber?: number;
      };
      responseBody: Seen[] | SeenExtended[] | Pagination<Seen> | Pagination<SeenExtended>;
    }>(async (req, res) => {
      const userId = Number(req.user);
  
      const page  = req.query.page;
      const limit  = req.query.limit;
      const extended  = req.query.extended;
      const mediaType  = req.query.mediaType;
      const tmdbId  = req.query.tmdbId;
      const seasonNumber  = req.query.seasonNumber;
      const episodeNumber  = req.query.episodeNumber;
  
      const query = Database.knex
        .from<Seen | SeenExtended>('seen')
        .modify((qb) => {
          if (extended) {
            qb
            .select(
              'seen.id',
              'seen.date',
              'seen.mediaItemId',
              'seen.episodeId',
              'seen.userId',
              'seen.duration',
              'mediaItem.title',
              'episode.title',
              'mediaItem.mediaType',
              'mediaItem.tmdbId',
              'episode.seasonNumber',
              'episode.episodeNumber',
            )
            .leftJoin('mediaItem', 'mediaItem.id', 'seen.mediaItemId')
            .leftJoin('episode', 'episode.id', 'seen.episodeId')
            .where((qb) => {
              if (mediaType) {
                qb.where('mediaItem.mediaType', mediaType);
              }
              if (tmdbId) {
                qb.where('mediaItem.tmdbId', tmdbId);
              }
              if (seasonNumber !== undefined) {
                qb.where('episode.seasonNumber', seasonNumber);
              }
              if (episodeNumber !== undefined) {
                qb.where('episode.episodeNumber', episodeNumber);
              }
            })
          }
        })
        .where('userId', userId)
        .orderBy('seen.date', 'desc')

      if (page) {
        const itemsPerPage = limit ?? 15;

        const sqlCountQuery = query
          .clone()
          .clearOrder()
          .clearSelect()
          .count('*', { as: 'count' })
          .first();

        const skip = itemsPerPage * (page - 1);
        const take = itemsPerPage;
        const sqlPaginationQuery = query
          .clone()
          .limit(take)
          .offset(skip);
      
        const [itemsCount, pagedItems] = await Database.knex.transaction(async (trx) => {
          const itemsCount = await sqlCountQuery.transacting(trx);
          const pagedItems = await sqlPaginationQuery.transacting(trx);
    
          return [itemsCount, pagedItems];
        });
  
        const total = Number(itemsCount.count);
        const from = itemsPerPage * (page - 1);
        const to = Math.min(total, itemsPerPage * page);
        const totalPages = Math.ceil(total / itemsPerPage);
    
        if (from > total) {
          throw new Error('Invalid page number');
        }
    
        res.send({
          from: from,
          to: to,
          data: pagedItems,
          total: total,
          page: page,
          totalPages: totalPages,
        });
      } else {
        const list = await query;
  
        res.send(list);
      }
    });
}
