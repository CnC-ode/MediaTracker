import { createExpressRoute } from 'typescript-routes-to-openapi-server';
import {
  GetItemsArgs,
  mediaItemRepository,
  Pagination,
} from 'src/repository/mediaItem';
import { MediaItemItemsResponse } from 'src/entity/mediaItem';

export type GetItemsRequest = Omit<
  GetItemsArgs,
  'userId' | 'mediaType' | 'mediaItemIds'
> &
  Partial<Pick<GetItemsArgs, 'mediaType'>>;

export class ItemsController {
  /**
   * @description Get items
   * @openapi_tags Items
   * @openapi_operationId paginated
   */
  getPaginated = createExpressRoute<{
    method: 'get';
    path: '/api/items/paginated';
    requestQuery: GetItemsRequest;
    responseBody: Pagination<MediaItemItemsResponse>;
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      filter,
      mediaType,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      page,
      limit,
      onlySeenItems,
      onlyOnWatchlist,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      onlyUnseenItems,
      includeUnreleasedItems,
    } = req.query;

    const orderBy = req.query.orderBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';

    if (page <= 0) {
      res.status(400);
      return;
    }

    const result = await mediaItemRepository.items({
      userId: userId,
      mediaType: mediaType,
      orderBy: orderBy,
      sortOrder: sortOrder,
      filter: filter,
      page: page,
      limit: limit,
      onlySeenItems: onlySeenItems,
      onlyOnWatchlist: onlyOnWatchlist,
      onlyWithNextEpisodesToWatch: onlyWithNextEpisodesToWatch,
      onlyWithNextAiring: onlyWithNextAiring,
      onlyWithUserRating: onlyWithUserRating,
      onlyWithoutUserRating: onlyWithoutUserRating,
      onlyWithProgress: onlyWithProgress,
      onlyUnseenItems: onlyUnseenItems,
      includeUnreleasedItems: includeUnreleasedItems,
    });

    res.send(result);
  });

  /**
   * @description Get items
   * @openapi_tags Items
   * @openapi_operationId get
   */
  get = createExpressRoute<{
    method: 'get';
    path: '/api/items';
    requestQuery: Omit<GetItemsRequest, 'page' | 'limit'>;
    responseBody: MediaItemItemsResponse[];
  }>(async (req, res) => {
    const userId = Number(req.user);

    const {
      filter,
      mediaType,
      onlyWithNextAiring,
      onlyWithNextEpisodesToWatch,
      onlySeenItems,
      onlyOnWatchlist,
      onlyWithUserRating,
      onlyWithoutUserRating,
      onlyWithProgress,
      onlyUnseenItems,
      includeUnreleasedItems,
    } = req.query;

    const orderBy = req.query.orderBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';

    const result = await mediaItemRepository.items({
      userId: userId,
      mediaType: mediaType,
      orderBy: orderBy,
      sortOrder: sortOrder,
      filter: filter,
      onlySeenItems: onlySeenItems,
      onlyOnWatchlist: onlyOnWatchlist,
      onlyWithNextEpisodesToWatch: onlyWithNextEpisodesToWatch,
      onlyWithNextAiring: onlyWithNextAiring,
      onlyWithUserRating: onlyWithUserRating,
      onlyWithoutUserRating: onlyWithoutUserRating,
      onlyWithProgress: onlyWithProgress,
      onlyUnseenItems: onlyUnseenItems,
      includeUnreleasedItems: includeUnreleasedItems,
    });

    res.send(result);
  });
}
