import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { listItemRepository } from 'src/repository/listItemRepository';
import { MediaType, ExternalIds } from 'src/entity/mediaItem';
import { findMediaItemByExternalIdInExternalSources } from 'src/metadata/findByExternalId';
import { ListItemExtended } from 'src/entity/list';
import { Database } from 'src/dbconfig';

/**
 * @openapi_tags Watchlist
 */
export class WatchlistController {
  /**
   * @openapi_operationId add
   */
  add = createExpressRoute<{
    method: 'put';
    path: '/api/watchlist';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { mediaItemId, seasonId, episodeId } = req.query;

    if (
      !(await listItemRepository.addItem({
        userId,
        mediaItemId,
        seasonId,
        episodeId,
        watchlist: true,
      }))
    ) {
      res.sendStatus(400);
    } else {
      res.send();
    }
  });

  /**
   * @openapi_operationId addByExternalId
   */
  addByExternalId = createExpressRoute<{
    method: 'put';
    path: '/api/watchlist/by-external-id';
    requestBody: {
      mediaType: MediaType;
      id: ExternalIds;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const mediaItem = await findMediaItemByExternalIdInExternalSources(req.body)

    if (!mediaItem) {
      res.sendStatus(404);
    }

    if (
      !(await listItemRepository.addItem({
        userId: userId,
        mediaItemId: mediaItem.id,
        watchlist: true,
      }))
    ) {
      res.sendStatus(400);
    } else {
      const listItem = await getItem({
        userId: userId,
        mediaType: mediaItem.mediaType,
        id: mediaItem.id,
      });      
      res.send(listItem);
    }
  });
  
  /**
   * @openapi_operationId delete
   */
  delete = createExpressRoute<{
    method: 'delete';
    path: '/api/watchlist';
    requestQuery: {
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);
    const { mediaItemId, seasonId, episodeId } = req.query;

    if (
      !(await listItemRepository.removeItem({
        userId,
        mediaItemId,
        seasonId,
        episodeId,
        watchlist: true,
      }))
    ) {
      res.sendStatus(400);
    } else {
      res.send();
    }
  });

  /**
   * @description Get watchlist item by external id
   * @openapi_operationId getByExternalId
   */
  get = createExpressRoute<{
    method: 'get';
    path: '/api/watchlist/by-external-id';
    requestQuery: {
      mediaType: MediaType;
      tmdbId: number;
    };
    responseBody: ListItemExtended;
  }>(async (req, res) => {
    const userId = Number(req.user);

    const mediaType  = req.query.mediaType;
    const tmdbId  = req.query.tmdbId;

    const listItem = await getItem({
      userId: userId,
      mediaType: mediaType,
      tmdbId: tmdbId,
    });

    if (!listItem) {
      res.sendStatus(204);
    } else {
      res.send(listItem);
    }
  });
}

const getItem = async (
  {userId, mediaType, id, tmdbId}
  : {userId: number, mediaType: MediaType, id?: number, tmdbId?: number})
  : Promise<ListItemExtended> => {
  return await Database.knex<ListItemExtended>('listItem')
    .select(
      'listItem.id',
      'listItem.listId',
      'listItem.mediaItemId',
      'listItem.seasonId',
      'listItem.episodeId',
      'listItem.addedAt',
      'listItem.type',
      'mediaItem.mediaType',
      'mediaItem.tmdbId',
    )
    .innerJoin('list', 'list.id', 'listItem.listId')
    .innerJoin('mediaItem', 'mediaItem.id', 'listItem.mediaItemId')
    .where('list.userId', userId)
    .where('list.isWatchlist', true)
    .where('mediaItem.mediaType', mediaType)
    .where((qb) => {
      if (id) {
        qb.where('mediaItem.id', id)
      }
      if (tmdbId) {
        qb.where('mediaItem.tmdbId', tmdbId)
      }
    })
    .first()
}