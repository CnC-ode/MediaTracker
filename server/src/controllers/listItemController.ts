import { listItemRepository } from 'src/repository/listItemRepository';
import { createExpressRoute } from 'typescript-routes-to-openapi-server';

import { MediaType, ExternalIds } from 'src/entity/mediaItem';
import { findMediaItemByExternalIdInExternalSources } from 'src/metadata/findByExternalId';
import { listRepository } from 'src/repository/list';

/**
 * @openapi_tags List Item
 */
export class ListItemController {
  /**
   * @openapi_operationId Add
   */
  addItem = createExpressRoute<{
    method: 'put';
    path: '/api/list-item';
    requestQuery: {
      listId: number;
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const currentUser = Number(req.user);
    const { listId, mediaItemId, seasonId, episodeId } = req.query;

    if (
      !(await listItemRepository.addItem({
        userId: currentUser,
        listId,
        mediaItemId,
        seasonId,
        episodeId,
      }))
    ) {
      res.sendStatus(400);
    } else {
      res.send();
    }
  });

  /**
   * @openapi_operationId Remove item from list
   */
  removeItem = createExpressRoute<{
    method: 'delete';
    path: '/api/list-item';
    requestQuery: {
      listId: number;
      mediaItemId: number;
      seasonId?: number;
      episodeId?: number;
    };
  }>(async (req, res) => {
    const currentUser = Number(req.user);
    const { listId, mediaItemId, seasonId, episodeId } = req.query;

    if (
      !(await listItemRepository.removeItem({
        userId: currentUser,
        listId,
        mediaItemId,
        seasonId,
        episodeId,
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
    path: '/api/list-item/by-external-id';
    requestBody: {
      listId: number;
      mediaType: MediaType;
      id: ExternalIds;
    };
  }>(async (req, res) => {
    const userId = Number(req.user);

    const { listId, mediaType, id } = req.body;

    const mediaItem = await findMediaItemByExternalIdInExternalSources({
      mediaType: mediaType,
      id: id
    });

    if (!mediaItem) {
      res.sendStatus(404);
    }

    if (
      !(await listItemRepository.addItem({
        userId: userId,
        mediaItemId: mediaItem.id,
        listId,
      }))
    ) {
      res.sendStatus(400);
    } else {
      const listItem = await listRepository.getItem({
        userId: userId,
        mediaType: mediaItem.mediaType,
        listId: listId,
        id: mediaItem.id,
      });
      res.send(listItem);
    }
  });
}
