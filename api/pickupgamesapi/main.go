package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"pickupgamesapi/types"
	"time"

	valid "github.com/asaskevich/govalidator"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/rs/zerolog/log"
)

type GameBase struct {
	Category       string   `json:"category" dynamodbav:"Category"`
	DurationMins   int      `json:"durationMins" dynamodbav:"DurationMins"`
	Location       string   `json:"location" dynamodbav:"Location"`
	Name           string   `json:"name" dynamodbav:"Name"`
	NumTeams       int      `json:"numTeams" dynamodbav:"NumTeams"`
	SignupFeeCents int      `json:"signupFeeCents" dynamodbav:"SignupFeeCents" valid:"-"`
	SplitFeeCents  int      `json:"splitFeeCents" dynamodbav:"SplitFeeCents" valid:"-"`
	TeamSize       int      `json:"teamSize" dynamodbav:"TeamSize"`
	Roster         []string `json:"roster" dynamodbav:"Roster"`
	WaitList       []string `json:"waitList" dynamodbav:"WaitList"`
}

// Game represents a game as returned by the API
type Game struct {
	GameBase
	Owner     string    `json:"owner"`
	GameID    string    `json:"gameId"`
	StartTime time.Time `json:"startTime"`
}

type GameList struct {
	Games []Game `json:"games"`
}

func GameFromGameRecord(gameRecord GameRecord) Game {
	return Game{
		GameBase:  gameRecord.GameBase,
		GameID:    gameRecord.GameID,
		StartTime: time.Unix(gameRecord.StartTime, 0),
		Owner:     gameRecord.Owner,
	}
}

// GameRecord represents a game record in DynamoDB
type GameRecord struct {
	GameBase

	GameID    string `dynamodbav:"GameID"`
	Owner     string `dynamodbav:"Owner"`
	StartTime int64  `dynamodbav:"StartTime"` // Unix timestamp -- seconds since 1970
}

// NewGameRequest is the accepted request body for creating a new game
type NewGameRequest struct {
	GameBase
	Requester string    `json:"-" valid:"-"`
	StartTime time.Time `json:"startTime"`
}

func (r *NewGameRequest) ValidateRequest(ctx context.Context) error {
	logger := log.Ctx(ctx)
	_, err := valid.ValidateStruct(r)
	if err != nil {
		logger.Err(err).Msg("failed to validate request")
		return &types.InvalidRequestError{ErrorCodeVal: 400, Message: fmt.Sprintf("Invalid request: %s", err.Error())}
	}
	return nil
}

// NewUserRequest
type NewUserRequest struct {
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phoneNumber"`
}

func (r *NewUserRequest) MissingFields() bool {
	return r.FirstName == "" || r.LastName == "" || r.Email == "" || r.Password == "" || r.PhoneNumber == ""
}

// ErrorMessage
type ErrorMessage struct {
	Message string `json:"message"`
}

func (e *ErrorMessage) String() string {
	errorStringBytes, _ := json.Marshal(e)
	return string(errorStringBytes)
}

func NewErrorMessage(message string) ErrorMessage {
	return ErrorMessage{
		Message: message,
	}
}

// Hander
type Handler struct {
	AWSCognitoClient     *cognitoidentityprovider.Client
	AWSDynamoDBClient    *dynamodb.Client
	userPoolID           string
	clientID             string
	pickupGamesTableName string
}

func returnSuccess(responseBody interface{}) (events.APIGatewayV2HTTPResponse, error) {
	if responseBody == nil {
		return events.APIGatewayV2HTTPResponse{
			StatusCode: 200,
		}, nil
	}
	responseBodyBytes, err := json.Marshal(responseBody)
	if err != nil {
		return returnServerError(err)
	}
	return events.APIGatewayV2HTTPResponse{
		StatusCode: 200,
		Body:       string(responseBodyBytes),
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}, nil
}

func returnServerError(err error) (events.APIGatewayV2HTTPResponse, error) {
	errorMessage := NewErrorMessage(err.Error())
	return events.APIGatewayV2HTTPResponse{
		StatusCode: 500,
		Body:       errorMessage.String(),
	}, nil
}

func returnNotFound() (events.APIGatewayV2HTTPResponse, error) {
	return events.APIGatewayV2HTTPResponse{
		StatusCode: 404,
	}, nil
}

func returnClientError(errMessage string) (events.APIGatewayV2HTTPResponse, error) {
	errorMessage := NewErrorMessage(errMessage)
	return events.APIGatewayV2HTTPResponse{
		StatusCode: 400,
		Body:       errorMessage.String(),
	}, nil
}

func (h *Handler) handler(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	// create context and initialize logger with caller
	ctx = log.Logger.With().Caller().Logger().WithContext(ctx)
	log.Ctx(ctx).Debug().Interface("event", event).Msg("received request")
	switch event.RouteKey {
	case "POST /auth/signup":
		{
			requestBody := event.Body
			newUserRequest := NewUserRequest{}
			if err := json.Unmarshal([]byte(requestBody), &newUserRequest); err != nil || newUserRequest.MissingFields() {
				return returnClientError("Invalid request body")
			}
			newUser, err := h.SignUpUser(ctx, newUserRequest)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(newUser)
		}
	case "POST /auth/signin":
		{
			requestBody := event.Body
			signInRequest := SignInRequest{}
			if err := json.Unmarshal([]byte(requestBody), &signInRequest); err != nil {
				log.Error().Err(err).Msg("failed to unmarshal request body")
				return returnClientError("Invalid request body")
			}
			signInResponse, err := h.SignInUser(ctx, signInRequest)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(signInResponse)
		}
	case "POST /games":
		{
			requestBody := event.Body
			newGameRequest := NewGameRequest{}
			requester := event.RequestContext.Authorizer.JWT.Claims["email"]
			if err := json.Unmarshal([]byte(requestBody), &newGameRequest); err != nil {
				log.Error().Err(err).Msg("failed to unmarshal request body")
				return returnClientError("Invalid request body")
			}
			if err := newGameRequest.ValidateRequest(ctx); err != nil {
				return returnClientError(err.Error())
			}
			newGameRequest.Requester = requester
			createGameResponse, err := h.CreateGame(ctx, newGameRequest)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(createGameResponse)
		}
	case "GET /games/{gameID}":
		{
			gameID := event.PathParameters["gameID"]
			getGameResponse, err := h.GetGame(ctx, gameID)
			if err != nil {
				// check if error == game not found
				if err.Error() == "game not found" {
					return returnNotFound()
				}
				return returnServerError(err)
			}
			return returnSuccess(getGameResponse)
		}
	case "POST /games/{gameID}/registrtation":
		{
			gameID := event.PathParameters["gameID"]
			requester, ok := event.RequestContext.Authorizer.JWT.Claims["email"]
			if !ok {
				// Cognito returns an ID token and an access token, only the ID token contains the email
				return returnClientError("token provided does not contain email")
			}
			registerGameResponse, err := h.RegisterForGame(ctx, gameID, requester)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(registerGameResponse)
		}
	case "DELETE /games/{gameID}/registration":
		{
			gameID := event.PathParameters["gameID"]
			requester := event.RequestContext.Authorizer.JWT.Claims["email"]
			dropFromGameResponse, err := h.DropFromGame(ctx, gameID, requester)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(dropFromGameResponse)
		}
	case "GET /games":
		{
			category := event.QueryStringParameters["category"]
			if category == "" {
				return returnClientError("category is required")
			}
			getGamesResponse, err := h.GetGames(ctx, category)
			if err != nil {
				return returnServerError(err)
			}
			return returnSuccess(getGamesResponse)
		}
	default:
		return events.APIGatewayV2HTTPResponse{
			StatusCode: 404,
		}, nil
	}
}

func main() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatal().Err(err).Msg("Unable to load SDK config")
	}
	cognitoClient := cognitoidentityprovider.NewFromConfig(cfg)
	dynamoDBClient := dynamodb.NewFromConfig(cfg)
	userPoolID := os.Getenv("USER_POOL_ID")
	if userPoolID == "" {
		log.Fatal().Msg("USER_POOL_ID is not set")
	}
	clientID := os.Getenv("CLIENT_ID")
	if clientID == "" {
		log.Fatal().Msg("CLIENT_ID is not set")
	}
	gamesTable := os.Getenv("PICKUP_GAMES_TABLE")
	if gamesTable == "" {
		log.Fatal().Msg("PICKUP_GAMES_TABLE is not set")
	}
	handler := Handler{
		AWSCognitoClient:     cognitoClient,
		AWSDynamoDBClient:    dynamoDBClient,
		userPoolID:           userPoolID,
		clientID:             clientID,
		pickupGamesTableName: gamesTable,
	}
	lambda.Start(handler.handler)
}
