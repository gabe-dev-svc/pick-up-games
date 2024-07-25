package com.pickupgames.exceptions;

import java.util.List;

public class MissingFieldsException extends ClientException {

  public MissingFieldsException(List<String> missingFields) {
    super( "Invalid request, missing the following required fields: " + String.join(", ", missingFields));
  }
}
