package com.pickupgames;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

public class ObjectMapperProvider {
  public static ObjectMapper objectMapper = new ObjectMapper();
  static {
    objectMapper.registerModule(new JavaTimeModule());
  }
}
