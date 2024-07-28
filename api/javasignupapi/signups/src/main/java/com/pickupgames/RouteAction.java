package com.pickupgames;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;

public interface RouteAction {
  public ActionResponse handleRequest(APIGatewayV2HTTPEvent input);
}
