package main

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type ErrorMessages string

const (
	ErrGameNotFound ErrorMessages = "game not found"
)

func (h *Handler) CreateGame(ctx context.Context, newGameRequest NewGameRequest) (Game, error) {
	log := log.Ctx(ctx).With().Str("operation", "CreateGame").Logger()
	log.Info().Interface("newGameRequest", newGameRequest).Msg("creating game")
	// Use newGameRequest to create a new gameRecord
	gameRecord := GameRecord{
		// set GameID to UUID
		GameBase:  newGameRequest.GameBase,
		GameID:    uuid.New().String(),
		Waitlist:  []string{},
		Roster:    []string{},
		Owner:     newGameRequest.Requester,
		StartTime: newGameRequest.StartTime.Unix(),
	}
	// save game to DynamoDB
	gameAttributeValue, err := attributevalue.MarshalMap(gameRecord)
	if err != nil {
		return Game{}, fmt.Errorf("failed to marshal game to attribute value: %w", err)
	}
	putItemInput := dynamodb.PutItemInput{
		TableName: &h.pickupGamesTableName,
		Item:      gameAttributeValue,
	}
	_, err = h.AWSDynamoDBClient.PutItem(ctx, &putItemInput)
	if err != nil {
		return Game{}, fmt.Errorf("failed to put game to DynamoDB: %w", err)
	}
	return GameFromGameRecord(gameRecord), nil
}

func (h *Handler) GetGame(ctx context.Context, gameID string) (Game, error) {
	log := log.Ctx(ctx).With().Str("operation", "GetGame").Logger()
	log.Info().Str("gameID", gameID).Msg("getting game")
	queryInput := dynamodb.QueryInput{
		TableName:              &h.pickupGamesTableName,
		KeyConditionExpression: aws.String("GameID = :gameID"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":gameID": &ddbtypes.AttributeValueMemberS{Value: gameID},
		},
	}
	getItemOutput, err := h.AWSDynamoDBClient.Query(ctx, &queryInput)
	if err != nil {
		return Game{}, fmt.Errorf("failed to get game from DynamoDB: %w", err)
	}
	if len(getItemOutput.Items) == 0 {
		return Game{}, fmt.Errorf(string(ErrGameNotFound))
	}
	if len(getItemOutput.Items) > 1 {
		return Game{}, fmt.Errorf("expected 1 game, got %d", len(getItemOutput.Items))
	}
	var gameRecord GameRecord
	err = attributevalue.UnmarshalMap(getItemOutput.Items[0], &gameRecord)
	if err != nil {
		return Game{}, fmt.Errorf("failed to unmarshal game record: %w", err)
	}
	return GameFromGameRecord(gameRecord), nil
}

func (h *Handler) GetGames(ctx context.Context, category string) (GameList, error) {
	log := log.Ctx(ctx).With().Str("operation", "GetGames").Logger()
	log.Info().Str("category", category).Msg("getting games")
	gameList := GameList{Games: []Game{}}
	queryInput := dynamodb.QueryInput{
		TableName:              &h.pickupGamesTableName,
		IndexName:              aws.String("SortedCategoryIndex"),
		KeyConditionExpression: aws.String("Category = :category AND StartTime >= :now"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":category": &ddbtypes.AttributeValueMemberS{Value: category},
			":now":      &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", time.Now().UTC().Unix())},
		},
	}
	getItemOutput, err := h.AWSDynamoDBClient.Query(ctx, &queryInput)
	if err != nil {
		return gameList, fmt.Errorf("failed to get games from DynamoDB: %w", err)
	}
	for _, item := range getItemOutput.Items {
		var gameRecord GameRecord
		err := attributevalue.UnmarshalMap(item, &gameRecord)
		if err != nil {
			return gameList, fmt.Errorf("failed to unmarshal game record: %w", err)
		}
		gameList.Games = append(gameList.Games, GameFromGameRecord(gameRecord))
	}
	return gameList, nil
}

func (h *Handler) DropFromGame(ctx context.Context, gameID string, requester string) (Game, error) {
	logger := log.Ctx(ctx).With().Str("operation", "DropFromGame").Str("gameID", gameID).Str("requester", requester).Logger()
	game, err := h.GetGame(ctx, gameID)
	if err != nil {
		if err.Error() == string(ErrGameNotFound) {
			return Game{}, err
		}
		logger.Error().Err(err).Msg("failed to get game")
		return Game{}, fmt.Errorf("failed to get game: %w", err)
	}
	// remember original roster and waitlist size for condition check later
	originalRosterSize := len(game.Roster)
	originalWaitlistSize := len(game.Waitlist)
	// check if requester is in waitlist
	playerInWaitlist := false
	for i, player := range game.Waitlist {
		if player == requester {
			// remove requester from waitlist
			playerInWaitlist = true
			game.Waitlist = append(game.Waitlist[:i], game.Waitlist[i+1:]...)
			break
		}
	}
	playerInRoster := false
	// check if requester is in roster
	for i, player := range game.Roster {
		if player == requester {
			// remove requester from roster
			playerInRoster = true
			game.Roster = append(game.Roster[:i], game.Roster[i+1:]...)
			// if there are players in waitlist, move the first one to roster
			if len(game.Waitlist) > 0 {
				game.Roster = append(game.Roster, game.Waitlist[0])
				game.Waitlist = game.Waitlist[1:]
			}
			break
		}
	}
	if !playerInWaitlist && !playerInRoster {
		return game, nil
	}
	// update roster and waitlist
	rosterList, err := attributevalue.MarshalList(game.Roster)
	if err != nil {
		logger.Error().Err(err).Msg("failed to marshal roster")
		return Game{}, fmt.Errorf("failed to marshal roster: %w", err)
	}
	waitList, err := attributevalue.MarshalList(game.Waitlist)
	if err != nil {
		logger.Error().Err(err).Msg("failed to marshal waitlist")
		return Game{}, fmt.Errorf("failed to marshal waitlist: %w", err)
	}
	updateItemInput := dynamodb.UpdateItemInput{
		TableName: &h.pickupGamesTableName,
		Key: map[string]ddbtypes.AttributeValue{
			"GameID":    &ddbtypes.AttributeValueMemberS{Value: gameID},
			"StartTime": &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", game.StartTime.Unix())},
		},
		UpdateExpression: aws.String("SET Roster = :roster, Waitlist = :waitlist"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":roster":              &ddbtypes.AttributeValueMemberL{Value: rosterList},
			":waitlist":            &ddbtypes.AttributeValueMemberL{Value: waitList},
			":currentRosterSize":   &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", originalRosterSize)},
			":currentWaitlistSize": &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", originalWaitlistSize)},
		},
		ReturnValues: "ALL_NEW",
		// condition check on roster and waitlist length
		ConditionExpression: aws.String("size(Roster) = :currentRosterSize AND size(Waitlist) = :currentWaitlistSize"),
	}
	returnValues, err := h.AWSDynamoDBClient.UpdateItem(ctx, &updateItemInput)
	if err != nil {
		logger.Error().Err(err).Msg("failed to update game")
		return Game{}, fmt.Errorf("failed to put game to DynamoDB: %w", err)
	}
	var updatedGame GameRecord
	err = attributevalue.UnmarshalMap(returnValues.Attributes, &updatedGame)
	if err != nil {
		logger.Error().Err(err).Msg("failed to unmarshal game record")
		return Game{}, fmt.Errorf("failed to unmarshal game record: %w", err)
	}
	return GameFromGameRecord(updatedGame), nil
}

func (h *Handler) RegisterForGame(ctx context.Context, gameID string, requester string) (Game, error) {
	logger := log.Ctx(ctx).With().Str("operation", "RegisterForGame").Logger()
	logger.Info().Str("gameID", gameID).Str("requester", requester).Msg("registering for game")
	// get game
	game, err := h.GetGame(ctx, gameID)
	if err != nil {
		if err.Error() == string(ErrGameNotFound) {
			return Game{}, err
		}
		log.Error().Err(err).Msg("failed to get game")
		return Game{}, fmt.Errorf("failed to get game: %w", err)
	}
	// check if requester is already in roster
	for _, player := range game.Roster {
		if player == requester {
			return game, nil
		}
	}
	// check if requester is already in waitlist
	for _, player := range game.Waitlist {
		if player == requester {
			return game, nil
		}
	}
	// add requester to roster or waitlist
	relevantList := "Roster"
	if len(game.Roster) >= game.NumTeams*game.TeamSize {
		relevantList = "Waitlist"
	}
	updateItemInput := dynamodb.UpdateItemInput{
		TableName: &h.pickupGamesTableName,
		Key: map[string]ddbtypes.AttributeValue{
			"GameID":    &ddbtypes.AttributeValueMemberS{Value: gameID},
			"StartTime": &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", game.StartTime.Unix())},
		},
		UpdateExpression:    aws.String("SET #RelevantList = list_append(#RelevantList, :registration)"),
		ConditionExpression: aws.String("size(#RosterList) = :currentRosterSize"),
		ExpressionAttributeValues: map[string]ddbtypes.AttributeValue{
			":registration":      &ddbtypes.AttributeValueMemberL{Value: []ddbtypes.AttributeValue{&ddbtypes.AttributeValueMemberS{Value: requester}}},
			":currentRosterSize": &ddbtypes.AttributeValueMemberN{Value: fmt.Sprintf("%d", len(game.Roster))},
		},
		ExpressionAttributeNames: map[string]string{
			"#RosterList":   "Roster",
			"#RelevantList": relevantList,
		},
		ReturnValues: "ALL_NEW",
	}
	returnValues, err := h.AWSDynamoDBClient.UpdateItem(ctx, &updateItemInput)
	if err != nil {
		logger.Error().Err(err).Msgf("failed to update game")
		return Game{}, fmt.Errorf("failed to put game to DynamoDB: %w", err)
	}
	var updatedGame GameRecord
	err = attributevalue.UnmarshalMap(returnValues.Attributes, &updatedGame)
	if err != nil {
		logger.Error().Err(err).Msgf("failed to unmarshal game record")
		return Game{}, fmt.Errorf("failed to unmarshal game record: %w", err)
	}
	return GameFromGameRecord(updatedGame), nil
}
