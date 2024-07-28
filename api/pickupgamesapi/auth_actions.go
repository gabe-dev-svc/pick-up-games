package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/rs/zerolog/log"
)

type User struct {
	Email       string `json:"email"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	PhoneNumber string `json:"phoneNumber"`
}

type SignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SignInResponse struct {
	AccessToken     string    `json:"accessToken"`
	RefreshToken    string    `json:"refreshToken"`
	IDToken         string    `json:"idToken"`
	TokenExpiration time.Time `json:"tokenExpiration"`
}

func (h *Handler) SignUpUser(ctx context.Context, newUserRequest NewUserRequest) (User, error) {
	log := log.Ctx(ctx).With().Str("operation", "SignUpUser").Logger()
	// Use newUserRequest to AdminCreateUser in Cognito
	adminCreateUserInput := &cognitoidentityprovider.AdminCreateUserInput{
		UserPoolId: aws.String(h.userPoolID),
		Username:   aws.String(newUserRequest.Email),
		UserAttributes: []types.AttributeType{
			{
				Name:  aws.String("email"),
				Value: aws.String(newUserRequest.Email),
			},
			{
				Name:  aws.String("phone_number"),
				Value: aws.String(newUserRequest.PhoneNumber),
			},
			{
				Name:  aws.String("given_name"),
				Value: aws.String(newUserRequest.FirstName),
			},
			{
				Name:  aws.String("family_name"),
				Value: aws.String(newUserRequest.LastName),
			},
		},
		MessageAction: types.MessageActionTypeSuppress,
	}
	_, err := h.AWSCognitoClient.AdminCreateUser(ctx, adminCreateUserInput)
	if err != nil {
		return User{}, fmt.Errorf("error creating user: %w", err)
	}
	log.Debug().Msg("successfully created user")
	// set user's password
	adminSetUserPasswordInput := &cognitoidentityprovider.AdminSetUserPasswordInput{
		UserPoolId: aws.String(os.Getenv("USER_POOL_ID")),
		Username:   aws.String(newUserRequest.Email),
		Password:   aws.String(newUserRequest.Password),
		Permanent:  true,
	}
	_, err = h.AWSCognitoClient.AdminSetUserPassword(ctx, adminSetUserPasswordInput)
	if err != nil {
		return User{}, fmt.Errorf("error setting user password: %w", err)
	}
	log.Debug().Msg("successfully set user password")
	return User{
		Email:       newUserRequest.Email,
		FirstName:   newUserRequest.FirstName,
		LastName:    newUserRequest.LastName,
		PhoneNumber: newUserRequest.PhoneNumber,
	}, nil
}

func (h *Handler) SignInUser(ctx context.Context, signInRequest SignInRequest) (SignInResponse, error) {
	log := log.Ctx(ctx).With().Str("operation", "SignInUser").Logger()
	// Use signInRequest to initiate auth flow in Cognito
	authFlow := types.AuthFlowTypeAdminNoSrpAuth
	authParameters := map[string]string{
		"USERNAME": signInRequest.Email,
		"PASSWORD": signInRequest.Password,
	}
	adminInitiateAuthInput := &cognitoidentityprovider.AdminInitiateAuthInput{
		UserPoolId:     aws.String(h.userPoolID),
		ClientId:       aws.String(h.clientID),
		AuthFlow:       authFlow,
		AuthParameters: authParameters,
	}
	adminInitiateAuthOutput, err := h.AWSCognitoClient.AdminInitiateAuth(ctx, adminInitiateAuthInput)
	if err != nil {
		return SignInResponse{}, fmt.Errorf("error initiating auth flow: %w", err)
	}
	log.Debug().Msg("successfully initiated auth flow")
	// return the tokens
	return SignInResponse{
		AccessToken:     *adminInitiateAuthOutput.AuthenticationResult.AccessToken,
		RefreshToken:    *adminInitiateAuthOutput.AuthenticationResult.RefreshToken,
		IDToken:         *adminInitiateAuthOutput.AuthenticationResult.IdToken,
		TokenExpiration: time.Now().Add(time.Duration(adminInitiateAuthOutput.AuthenticationResult.ExpiresIn) * time.Second),
	}, nil
}
