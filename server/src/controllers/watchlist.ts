import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import { listItemRepository } from 'src/repository/listItemRepository';
import { listRepository } from 'src/repository/list';
import { MediaType, ExternalIds } from 'src/entity/mediaItem';
import { findMediaItemByExternalIdInExternalSources } from 'src/metadata/findByExternalId';
import { ListItemExtended } from 'src/entity/list';

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
      const listItem = await listRepository.getItem({
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

    const mediaType = req.query.mediaType;
    const tmdbId = req.query.tmdbId;

    const listItem = await listRepository.getItem({
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

