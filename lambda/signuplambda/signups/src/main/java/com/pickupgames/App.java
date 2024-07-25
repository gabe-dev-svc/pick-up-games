package com.pickupgames;

import java.util.HashMap;
import java.util.Map;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse.APIGatewayV2HTTPResponseBuilder;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent.RequestContext.Authorizer.JWT;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.pickupgames.clients.GameClient;
import com.pickupgames.dtos.ErrorResponse;
import com.pickupgames.entities.GameEntity;
import com.pickupgames.exceptions.ClientException;
import com.pickupgames.operations.GameOperations;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

/**
 * Lambda function entry point. You can change to use other pojo type or implement a different
 * RequestHandler.
 *
 * @see <a href=https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html>Lambda Java
 *      Handler</a> for more information
 */
@Slf4j
public class App implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

  private final GameOperations gameOperations;
  private final DynamoDbClient ddbClient;
  private ObjectMapper objectMapper = ObjectMapperProvider.objectMapper;
  private final Map<String, RouteAction> routeActions = new HashMap<>();

  public App() {
    // set up clients and operations
    this.ddbClient = DynamoDbClient.create();
    // get environment variables
    String gameTableName = System.getenv("PICKUP_GAMES_TABLE");
    if (gameTableName == null || gameTableName.isEmpty()) {
      throw new IllegalStateException("PICKUP_GAMES_TABLE not provided");
    }
    
    // set up DynamoDB abstractions
    final TableSchema<GameEntity> gameEntitySchema = TableSchema.fromBean(GameEntity.class);
    DynamoDbEnhancedClient enhancedDdbClient =
        DynamoDbEnhancedClient.builder().dynamoDbClient(ddbClient).build();
    DynamoDbTable<GameEntity> gameTable = enhancedDdbClient.table(gameTableName, gameEntitySchema);

    // create any clients specific to the domain
    GameClient gameClient = new GameClient(gameTable);

    // setup operations and actions
    this.gameOperations = new GameOperations(gameClient);
    routeActions.put("POST /java/games", gameOperations::createGame);
    routeActions.put("GET /java/games", gameOperations::getGames);
    routeActions.put("GET /java/games/{gameID}", gameOperations::getGame);
    routeActions.put("PATCH /java/games/{gameID}/join", gameOperations::joinGame);
    routeActions.put("PATCH /java/games/{gameID}/drop", gameOperations::dropFromGame);
  }

  // handleRequest is the entry point for the Lambda function and is only concerned with routing 
  // requests to the appropriate handler method, and ensuring the response returned in the appropriate 
  // format. The actual business logic is implemented in the handler methods.
  @Override
  public APIGatewayV2HTTPResponse handleRequest(final APIGatewayV2HTTPEvent input,
      final Context context) {
    // break up input into separate variables to identify possible NPE
    log.debug("received request: {}", input);
    log.info("recevied request with route: {}", input.getRouteKey());
    RequestContext requestContext = input.getRequestContext();
    Authorizer authorizer = requestContext.getAuthorizer();
    if (authorizer != null) {
      JWT jwt = authorizer.getJwt();
      Map<String, String> claims = jwt.getClaims();
      String email = claims.get("email");
      log.info("requester: {}", email);
    }
    // check input path and verb and call appropriate method
    String route = input.getRouteKey();
    APIGatewayV2HTTPResponseBuilder responseBuilder = APIGatewayV2HTTPResponse.builder().withHeaders(Map.of("Content-Type", "application/json"));

    if (!routeActions.containsKey(route)) {
      log.warn("no action found for route: {}", route);
      return responseBuilder.withStatusCode(404).build();
    }
    RouteAction action = routeActions.get(route);
    try {
      ActionResponse actionResponse = action.handleRequest(input);
      String responseBody = objectMapper.writeValueAsString(actionResponse.getValue());
      return responseBuilder.withStatusCode(actionResponse.getStatusCode())
          .withBody(responseBody).build();
    } catch (ClientException ex) {
      log.error("ClientException encountered", ex);
      ErrorResponse errorResponse = new ErrorResponse(ex.getMessage(), 400);
      try {
        return responseBuilder.withStatusCode(400)
            .withBody(objectMapper.writeValueAsString(errorResponse)).build();
      } catch (JsonProcessingException e) {
        // TODO: ObjectMapper shouldn't have issues serializing ErrorResponse, emit a failure metric
        // + alarm
        log.error("Error serializing error response", e);
        return responseBuilder.withStatusCode(400).build();
      }
    } catch (Exception ex) {
      log.error("Unhandled exception, encountered", ex);
      return responseBuilder.withStatusCode(500).build();
    }
  }
}
