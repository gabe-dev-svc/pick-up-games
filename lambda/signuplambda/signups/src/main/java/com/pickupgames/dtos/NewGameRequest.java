package com.pickupgames.dtos;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.pickupgames.validations.Validation;
import com.pickupgames.exceptions.MissingFieldsException;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public class NewGameRequest extends GameBase {

  public void validateFields() throws MissingFieldsException {
    List<String> missingFields = new ArrayList<>();

    Map<String, Validation.Getter<String>> stringValidations = new HashMap<>();
    stringValidations.put("category", this::getCategory);
    stringValidations.put("location", this::getLocation);
    stringValidations.put("name", this::getName);
    for(Map.Entry<String, Validation.Getter<String>> stringValidation : stringValidations.entrySet()) {
      if (Validation.stringIsEmpty(stringValidation.getValue())) {
        missingFields.add(stringValidation.getKey());
      }
    }

    Map<String, Validation.Getter<Object>> objectValidations = new HashMap<>();
    objectValidations.put("durationMins", this::getDurationMins);
    objectValidations.put("signUpFeeCents", this::getSignUpFeeCents);
    objectValidations.put("splitFeeCents", this::getSplitFeeCents);
    objectValidations.put("teamSize", this::getTeamSize);
    objectValidations.put("startTime", this::getStartTime);
    for(Map.Entry<String, Validation.Getter<Object>> objectValidation : objectValidations.entrySet()) {
      if (Validation.objectIsEmpty(objectValidation.getValue())) {
        missingFields.add(objectValidation.getKey());
      }
    }

    if(!missingFields.isEmpty()) {
      throw new MissingFieldsException(missingFields);
    }
  }
}

