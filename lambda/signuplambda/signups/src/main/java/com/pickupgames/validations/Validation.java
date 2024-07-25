package com.pickupgames.validations;

public class Validation {
  public interface Getter<T> {
    T get();
  }

  public static boolean stringIsEmpty(Getter<String> getter) {
    return getter == null || getter.get().length() == 0;
  }

  public static boolean objectIsEmpty(Getter<Object> getter) {
    return getter.get() == null;
  }

}
