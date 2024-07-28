package com.pickupgames.exceptions;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ClientException extends RuntimeException{
  protected String message;

  public String getMessage() {
    return this.message;
  }
}
