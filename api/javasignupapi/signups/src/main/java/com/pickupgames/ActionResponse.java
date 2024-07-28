package com.pickupgames;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ActionResponse {
  private final Object value;
  private final int statusCode;
}
