package com.pickupgames.operations;

import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pickupgames.ActionResponse;
import com.pickupgames.ObjectMapperProvider;
import com.pickupgames.clients.GameClient;
import com.pickupgames.dtos.Game;
import com.pickupgames.dtos.NewGameRequest;
import com.pickupgames.entities.GameEntity;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@AllArgsConstructor
public class GameOperations {

  private static ObjectMapper objectMapper = ObjectMapperProvider.objectMapper;
  private final GameClient gameClient;

  public ActionResponse createGame(APIGatewayV2HTTPEvent input) {
    NewGameRequest newGameRequest = null;
    try {
      newGameRequest = objectMapper.readValue(input.getBody(), NewGameRequest.class);
    } catch (Exception e) {
      log.error("Error parsing request body", e);
      throw new RuntimeException("Error parsing request body");
    }
    String requester = input.getRequestContext().getAuthorizer().getJwt().getClaims().get("email");
    // map request to new game entity
    GameEntity newGameEntity = mapNewGameRequestToGameEntity(newGameRequest, requester);
    gameClient.createGame(newGameEntity);
    // map stored request to game dto
    Game gameResponse = mapGameEntityToGame(newGameEntity);
    return new ActionResponse(gameResponse, 200);
  }

  public ActionResponse dropFromGame(APIGatewayV2HTTPEvent input) {
    String gameId = input.getPathParameters().get("gameID");
    String requester = input.getRequestContext().getAuthorizer().getJwt().getClaims().get("email");
    log.debug("requester {} dropping from game {}", requester, gameId);
    GameEntity gameEntity = gameClient.getGame(gameId);
    if (gameEntity.getRoster().contains(requester)) {
      // remove requester from roster, add next person from waitlist if needed
      gameEntity.getRoster().remove(requester);
      if (gameEntity.getWaitList().size() > 0) {
        gameEntity.getRoster().add(gameEntity.getWaitList().remove(0));
      }
    } else if (gameEntity.getWaitList().contains(requester)) {
      // remove requester from waitlist
      gameEntity.getWaitList().remove(requester);
    } else {
      // if requester's not in roster or waitlist, return 200 for idempotency
      return new ActionResponse(gameEntity, 200);
    }
    gameClient.saveGame(gameEntity);
    return new ActionResponse(gameEntity, 200);
  }

  public ActionResponse joinGame(APIGatewayV2HTTPEvent input) {
    String gameId = input.getPathParameters().get("gameID");
    String requester = input.getRequestContext().getAuthorizer().getJwt().getClaims().get("email");
    log.debug("requester {} joining game {}", requester, gameId);
    GameEntity gameEntity = gameClient.getGame(gameId);
    if (gameEntity.getRoster().contains(requester) || gameEntity.getWaitList().contains(requester)) {
      return new ActionResponse(gameEntity, 200);
    }
    if (gameEntity.getRoster().size() >= gameEntity.getNumTeams() * gameEntity.getTeamSize()) {
      gameEntity.getWaitList().add(requester);
    } else {
      gameEntity.getRoster().add(requester);
    }
    gameClient.saveGame(gameEntity);
    return new ActionResponse(gameEntity, 200);
  }

  public ActionResponse getGame(APIGatewayV2HTTPEvent input) {
    String gameId = input.getPathParameters().get("gameID");
    GameEntity gameEntity = gameClient.getGame(gameId);
    Game game = mapGameEntityToGame(gameEntity);
    return new ActionResponse(game, 200);
  }

  public ActionResponse getGames(APIGatewayV2HTTPEvent input) {
    String category = input.getQueryStringParameters().get("category");
    if (category == null || category.isEmpty()) {
      return new ActionResponse("Category is required", 400);
    }
    int maxResults = Integer.parseInt(Optional.ofNullable(input.getQueryStringParameters().get("maxResults")).orElse("10"));
    log.debug("getting games for category {} with max results {}", category, maxResults);
    List<GameEntity> gameEntities = gameClient.getGames(category, maxResults);
    log.debug("got {} total games", gameEntities.size());
    List<Game> games = new ArrayList<>();
    gameEntities.forEach(gameEntity -> games.add(mapGameEntityToGame(gameEntity)));
    log.debug("mapped games to dtos");
    return new ActionResponse(games, 200);
  }

  static GameEntity mapNewGameRequestToGameEntity(NewGameRequest newGameRequest, String requester) {
    return GameEntity.builder().owner(requester)
        .startTimeSeconds(BigInteger.valueOf(newGameRequest.getStartTime().getEpochSecond()))
        .category(newGameRequest.getCategory()).durationMins(newGameRequest.getDurationMins())
        .location(newGameRequest.getLocation()).name(newGameRequest.getName())
        .numTeams(newGameRequest.getNumTeams()).signUpFeeCents(newGameRequest.getSignUpFeeCents())
        .splitFeeCents(newGameRequest.getSplitFeeCents()).teamSize(newGameRequest.getTeamSize())
        .roster(new ArrayList<>()).waitList(new ArrayList<>()).build();
  }

  static Game mapGameEntityToGame(GameEntity gameEntity) {
    log.debug("mapping game entity {}", gameEntity);
    return Game.builder().gameId(gameEntity.getGameId()).category(gameEntity.getCategory())
        .durationMins(gameEntity.getDurationMins()).name(gameEntity.getName())
        .startTime(Instant.ofEpochSecond(gameEntity.getStartTimeSeconds().longValue()))
        .location(gameEntity.getLocation()).numTeams(gameEntity.getNumTeams())
        .signUpFeeCents(gameEntity.getSignUpFeeCents()).splitFeeCents(gameEntity.getSplitFeeCents())
        .roster(Optional.ofNullable(gameEntity.getRoster()).orElse(new ArrayList<>())).waitList(Optional.ofNullable(gameEntity.getWaitList()).orElse(new ArrayList<>()))
        .teamSize(gameEntity.getTeamSize())
        .owner(gameEntity.getOwner()).build();
  }
}
