package com.pickupgames.dtos;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Getter
@Setter
@NoArgsConstructor
@SuperBuilder
public abstract class GameBase {
  protected String category;
  protected Integer durationMins;
  protected String location;
  protected String name;
  protected Integer numTeams;
  protected Integer signUpFeeCents;
  protected Integer splitFeeCents;
  protected Integer teamSize;
  protected List<String> roster = new ArrayList<>();
  protected List<String> waitList = new ArrayList<>();
  @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss'Z'", timezone="UTC")
  protected Instant startTime;
}
