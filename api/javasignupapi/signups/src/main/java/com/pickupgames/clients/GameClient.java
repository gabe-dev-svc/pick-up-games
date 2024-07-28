package com.pickupgames.clients;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.time.Duration;
import java.time.Instant;
import com.pickupgames.entities.GameEntity;
import com.pickupgames.exceptions.ClientException;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.pagination.sync.SdkIterable;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbIndex;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.model.Page;
import software.amazon.awssdk.enhanced.dynamodb.model.PutItemEnhancedRequest;
import software.amazon.awssdk.enhanced.dynamodb.model.PutItemEnhancedResponse;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.UpdateItemEnhancedRequest;

@Slf4j
public class GameClient {

  private final DynamoDbTable<GameEntity> gameTable;

  public GameEntity createGame(GameEntity newGame) {
    log.debug("saving game to ddb");
    if (newGame.getGameId() == null || newGame.getGameId().isEmpty()) {
      newGame.setGameId(UUID.randomUUID().toString());
      PutItemEnhancedResponse<GameEntity> response = this.gameTable.putItemWithResponse(
          PutItemEnhancedRequest.builder(GameEntity.class).item(newGame).build());
      log.debug("saved game to ddb: {}", response);
      return response.attributes() != null ? response.attributes() : new GameEntity();
    } else {
      throw new ClientException("Cannot create a game with an existing ID");
    }
  }

  public GameEntity saveGame(GameEntity game) {
    log.debug("saving game to ddb {}", game);
    this.gameTable.updateItem(UpdateItemEnhancedRequest.builder(GameEntity.class).item(game).build());
    return game;
  }

  public GameEntity getGame(String gameId) {
    return this.gameTable.getItem(r -> r.key(k -> k.partitionValue(gameId)));
  }

  // queries the SortedCategoryIndex to get games in the last 14 days, returns up to maxResults
  public List<GameEntity> getGames(String category, int maxResults) {
    if (maxResults < 1) {
      maxResults = 10;
    }
    QueryConditional queryConditional = QueryConditional.sortGreaterThanOrEqualTo(k -> k.partitionValue(category)
        .sortValue(Instant.now().minus(Duration.ofDays(14)).getEpochSecond()));
    DynamoDbIndex<GameEntity> categoryGSI = gameTable.index("SortedCategoryIndex");
    Iterator<Page<GameEntity>> results = categoryGSI.query(queryConditional).iterator();
    List<GameEntity> games = new ArrayList<>();
    while (games.size() < maxResults && results.hasNext()) {
      Page<GameEntity> page = results.next();
      page.items().forEach(games::add);
    }
    return games;
  }

  public GameClient(DynamoDbTable<GameEntity> gameTable) {
    this.gameTable = gameTable;
  }
}
