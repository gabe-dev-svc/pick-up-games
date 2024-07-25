package com.pickupgames.entities;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.Setter;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

@DynamoDbBean
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GameEntity {

  private String gameId;
  private String owner;
  private BigInteger startTimeSeconds;
  private String category;
  private Integer durationMins;
  private String location;
  private String name;
  private Integer numTeams;
  private Integer signUpFeeCents;
  private Integer splitFeeCents;
  private Integer teamSize;
  private List<String> roster = new ArrayList<>();
  private List<String> waitList = new ArrayList<>();


  @DynamoDbPartitionKey
  @DynamoDbAttribute(value = "GameID")
  public String getGameId() {
    return this.gameId;
  }

  @DynamoDbSecondarySortKey(indexNames = {"SortedCategoryIndex"})
  @DynamoDbAttribute(value = "StartTime")
  public BigInteger getStartTimeSeconds() {
    return this.startTimeSeconds;
  }

  @DynamoDbAttribute(value = "Owner")
  public String getOwner() {
    return this.owner;
  }


  @DynamoDbSecondaryPartitionKey(indexNames = {"SortedCategoryIndex"})
  @DynamoDbAttribute(value = "Category")
  public String getCategory() {
    return this.category;
  }

  @DynamoDbAttribute(value = "DurationMins")
  public Integer getDurationMins() {
    return this.durationMins;
  }

  @DynamoDbAttribute(value = "Location")
  public String getLocation() {
    return this.location;
  }

  @DynamoDbAttribute(value = "Name")
  public String getName() {
    return this.name;
  }

  @DynamoDbAttribute(value = "NumTeams")
  public Integer getNumTeams() {
    return this.numTeams;
  }

  @DynamoDbAttribute(value = "SignUpFeeCents")
  public Integer getSignUpFeeCents() {
    return this.signUpFeeCents;
  }

  @DynamoDbAttribute(value = "SplitFeeCents")
  public Integer getSplitFeeCents() {
    return this.splitFeeCents;
  }

  @DynamoDbAttribute(value = "TeamSize")
  public Integer getTeamSize() {
    return this.teamSize;
  }

  @DynamoDbAttribute(value = "Roster")
  public List<String> getRoster() {
    return this.roster;
  }

  @DynamoDbAttribute(value = "WaitList")
  public List<String> getWaitList() {
    return this.waitList;
  }

  @Override
  public String toString() {
    return "GameEntity{" +
        "gameId='" + gameId + '\'' +
        ", owner='" + owner + '\'' +
        ", startTimeSeconds=" + startTimeSeconds +
        ", category='" + category + '\'' +
        ", durationMins=" + durationMins +
        ", location='" + location + '\'' +
        ", name='" + name + '\'' +
        ", numTeams=" + numTeams +
        ", signUpFeeCents=" + signUpFeeCents +
        ", splitFeeCents=" + splitFeeCents +
        ", teamSize=" + teamSize +
        ", roster=" + roster +
        ", waitList=" + waitList +
        '}';
  }
}
