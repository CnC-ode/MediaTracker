import { Knex } from 'knex';
import { Database } from 'src/dbconfig';
import { List, ListItem } from 'src/entity/list';
import { TvEpisode } from 'src/entity/tvepisode';
import { TvSeason } from 'src/entity/tvseason';
import { repository } from 'src/repository/repository';

class ListItemRepository extends repository<ListItem>({
  tableName: 'listItem',
  primaryColumnName: 'id',
}) {
  async addManyItems(args: {
    userId: number;
    listId: number;
    listItems: { mediaItemId: number; seasonId?: number; episodeId?: number }[];
  }) {
    const { userId, listId, listItems } = args;

    return await Database.knex.transaction(async (trx) => {
      const list = await trx<List>('list')
        .where({ id: listId, userId: userId })
        .first();

      if (!list || (list.userId !== userId && list.privacy === 'private')) {
        return false;
      }

      const existingListItems = await trx<ListItem>('listItem').where({
        listId: listId,
      });

      const serializeListItem = (listItem: {
        mediaItemId: number;
        seasonId?: number;
        episodeId?: number;
      }) => {
        return JSON.stringify([
          listItem.mediaItemId,
          listItem.seasonId,
          listItem.episodeId,
        ]);
      };
      const existingListItemsSet = new Set(
        existingListItems.map(serializeListItem)
      );

      const itemsToAdd = listItems
        .filter(
          (listItem) => !existingListItemsSet.has(serializeListItem(listItem))
        )
        .map((listItem) => ({
          listId: listId,
          addedAt: new Date().getTime(),
          mediaItemId: listItem.mediaItemId,
          seasonId: listItem.seasonId,
          episodeId: listItem.episodeId,
        }));

      if (itemsToAdd.length > 0) {
        await trx.batchInsert<ListItem>('listItem', itemsToAdd, 30);
      }

      return true;
    });
  }

  addItem = this.#addOrRemoveListItemFactory(async (trx, args) => {
    const { mediaItemId, seasonId, episodeId, listId } = args;

    if (mediaItemId && seasonId) {
      const season = await trx<TvSeason>('season')
        .where('tvShowId', mediaItemId)
        .where('id', seasonId)
        .first();

      if (!season) {
        return false;
      }
    }

    if (mediaItemId && episodeId) {
      const episode = await trx<TvEpisode>('episode')
        .where('tvShowId', mediaItemId)
        .where('id', episodeId)
        .first();

      if (!episode) {
        return false;
      }
    }

    const existingItems = await trx('listItem').where({
      listId: listId,
      mediaItemId: mediaItemId,
      seasonId: episodeId == undefined ? seasonId || null : null,
      episodeId: episodeId || null,
    });

    if (existingItems.length > 0) {
      return false;
    }

    await trx('listItem').insert({
      listId: listId,
      mediaItemId: mediaItemId,
      seasonId: episodeId == undefined ? seasonId || null : null,
      episodeId: episodeId || null,
      addedAt: new Date().getTime(),
    });

    return true;
  });

  removeItem = this.#addOrRemoveListItemFactory(async (trx, args) => {
    const { mediaItemId, seasonId, episodeId, listId } = args;

    const listItem = await trx('listItem')
      .where({
        mediaItemId: mediaItemId,
        seasonId: seasonId || null,
        episodeId: episodeId || null,
        listId: listId,
      })
      .first();

    let deleted = 0;
    if (listItem) {
      deleted = await trx('listItem').delete().where('id', listItem.id);
    }

    return deleted > 0;
  });

  #addOrRemoveListItemFactory(
    fn: (
      trx: Knex.Transaction,
      args: {
        userId: number;
        mediaItemId: number;
        seasonId?: number;
        episodeId?: number;
        listId: number;
      }
    ) => Promise<boolean>
  ) {
    return async (
      args: {
        userId: number;
        mediaItemId: number;
        seasonId?: number;
        episodeId?: number;
      } & (
        | {
            watchlist: true;
          }
        | {
            listId: number;
          }
      )
    ) => {
      const { userId, listId, watchlist, mediaItemId, seasonId, episodeId } = {
        listId: undefined,
        watchlist: undefined,
        ...args,
      };

      if (
        (listId != undefined && watchlist != undefined) ||
        (listId == undefined && watchlist == undefined)
      ) {
        throw new Error(
          'only one of listId and addToWatchlist arguments should be provided'
        );
      }

      return await Database.knex.transaction(async (trx) => {
        const list = await trx<List>('list')
          .where(
            listId != undefined
              ? {
                  id: listId,
                }
              : {
                  isWatchlist: true,
                  userId: userId,
                }
          )
          .first();

        if (!list || (list.userId !== userId && list.privacy === 'private')) {
          return false;
        }

        return fn(trx, {
          mediaItemId,
          seasonId,
          episodeId,
          userId,
          listId: list.id,
        });
      });
    };
  }
}

export const listItemRepository = new ListItemRepository();
