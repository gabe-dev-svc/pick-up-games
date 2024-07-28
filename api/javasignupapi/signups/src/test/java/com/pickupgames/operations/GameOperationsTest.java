package com.pickupgames.operations;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer.JWT;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pickupgames.ObjectMapperProvider;
import com.pickupgames.clients.GameClient;
import com.pickupgames.dtos.Game;
import com.pickupgames.dtos.NewGameRequest;
import com.pickupgames.entities.GameEntity;
import lombok.SneakyThrows;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import java.math.BigInteger;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class GameOperationsTest {

  static final ObjectMapper objectMapper = ObjectMapperProvider.objectMapper;

  @Test
  public void testMapGameRequestToEntity() {
    // tests that the mapNewGameRequestToGameEntity method correctly maps a NewGameRequest to a GameEntity
    NewGameRequest newGameRequest = testNewGameRequest();
    String requester = "testRequester";
    GameEntity gameEntity = GameOperations.mapNewGameRequestToGameEntity(newGameRequest, requester);
    assertEquals(requester, gameEntity.getOwner());
    assertEquals(newGameRequest.getStartTime().getEpochSecond(),
        gameEntity.getStartTimeSeconds().longValue());
    assertEquals(newGameRequest.getCategory(), gameEntity.getCategory());
    assertEquals(newGameRequest.getDurationMins(), gameEntity.getDurationMins());
    assertEquals(newGameRequest.getLocation(), gameEntity.getLocation());
    assertEquals(newGameRequest.getName(), gameEntity.getName());
    assertEquals(newGameRequest.getNumTeams(), gameEntity.getNumTeams());
    assertEquals(newGameRequest.getSignUpFeeCents(), gameEntity.getSignUpFeeCents());
    assertEquals(newGameRequest.getSplitFeeCents(), gameEntity.getSplitFeeCents());
    assertEquals(newGameRequest.getTeamSize(), gameEntity.getTeamSize());
    assertNotNull(gameEntity.getRoster());
    assertNotNull(gameEntity.getWaitList());
  }

  @Test
  public void testMapGameEntityToGame() {
    // tests that the mapGameEntityToGame method correctly maps a GameEntity to a Game
    GameEntity gameEntity = testNewGameEntity();
    Game game = GameOperations.mapGameEntityToGame(gameEntity);
    assertEquals(gameEntity.getGameId(), game.getGameId());
    assertEquals(gameEntity.getCategory(), game.getCategory());
    assertEquals(gameEntity.getDurationMins(), game.getDurationMins());
    assertEquals(gameEntity.getName(), game.getName());
    assertEquals(gameEntity.getStartTimeSeconds().longValue(), game.getStartTime().getEpochSecond());
    assertEquals(gameEntity.getLocation(), game.getLocation());
    assertEquals(gameEntity.getNumTeams(), game.getNumTeams());
    assertEquals(gameEntity.getSignUpFeeCents(), game.getSignUpFeeCents());
    assertEquals(gameEntity.getSplitFeeCents(), game.getSplitFeeCents());
    assertNotNull(game.getRoster());
    assertNotNull(game.getWaitList());
    assertEquals(gameEntity.getOwner(), game.getOwner());
  }

  public static NewGameRequest testNewGameRequest() {
    return NewGameRequest.builder().name("testingName").category("testingCategory").durationMins(60)
        .location("testingLocation").numTeams(2).signUpFeeCents(100).splitFeeCents(100).teamSize(5)
        .startTime(Instant.now()).build();
  }

  public static GameEntity testNewGameEntity() {
    return GameEntity.builder().gameId("testGameId").owner("testOwner")
        .startTimeSeconds(BigInteger.valueOf(Instant.now().getEpochSecond())).category("testCategory")
        .durationMins(60).location("testLocation").name("testName").numTeams(2).signUpFeeCents(100)
        .splitFeeCents(100).teamSize(5).build();
  }

  public static GameEntity testGameEntityWithRoster() {
    GameEntity newGameEntity = testNewGameEntity();
    newGameEntity.setRoster(List.of("testPlayer1", "testPlayer2"));
    newGameEntity.setWaitList(List.of("testPlayer1", "testPlayer2"));
    return newGameEntity;
  }
}
