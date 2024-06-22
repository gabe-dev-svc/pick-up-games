import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as eventsources from "aws-cdk-lib/aws-lambda-event-sources";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayintegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwauth from "aws-cdk-lib/aws-apigatewayv2-authorizers";

export class PickupApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // create new UserPool
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
    });
    // create app client for UserPool
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: userPool,
      userPoolClientName: "PickupGamesAPI",
      authFlows: {
        adminUserPassword: true,
      }
    });
    // create new DynamoDB table called PickupGames with a parition key of 'GameID' and a sort key of 'StartTime'
    const pickupGamesTable = new dynamodb.Table(this, "PickupGames", {
      partitionKey: { name: "GameID", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "StartTime", type: dynamodb.AttributeType.NUMBER },
    });
    // a tradeoff is being made where we cannot get all results in a single query. 
    // the solution is to create a GSI on a known value and that will allow us to sort by the sort key, or get past/recent events
    pickupGamesTable.addGlobalSecondaryIndex({
      indexName: "SortedCategoryIndex",
      partitionKey: { name: "Category", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "StartTime", type: dynamodb.AttributeType.NUMBER },
    });
    // create a GoLang Lambda function called 'GameSignupHandler' that will be triggered by the 'GameSignups' SQS queue and will write to the 'PickupGames' DynamoDB table
    const gameSignupLambda = new lambda.Function(this, "GameSignupHandler", {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: "bootstrap",
      code: lambda.Code.fromAsset("../lambda/out/bin/pickupgamesapi.zip"),
      environment: {
        PICKUP_GAMES_TABLE: pickupGamesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    pickupGamesTable.grantReadWriteData(gameSignupLambda);
    // create API Gateway integration
    const pickupGamesLambdaIntegration =
      new apigatewayintegrations.HttpLambdaIntegration(
        "PickupGamesIntegration",
        gameSignupLambda
      );
    // create HttpUserPoolAuthorizer for use with API Gateway
    const userPoolAuthorizer = new apigwauth.HttpUserPoolAuthorizer(
     "PickupGamesAPIAuthorizer",
     userPool,
     {
      userPoolClients: [userPoolClient],
     }
    );
    // create new API Gateway with a default stage and the 'PickupGamesAPI' integration  
    const api = new apigateway.HttpApi(this, "PickupGamesAPI", {
      createDefaultStage: true,
      defaultIntegration: pickupGamesLambdaIntegration,
    });
    // read open api spec found in lib/resources/player-signups.json and create routes
    const playerSignupsSpec = require("./resources/player-signups.json");
    for (let path in playerSignupsSpec.paths) {
      const method = playerSignupsSpec.paths[path];
      Object.keys(method).forEach((verb) => {
        let verbAsHttpMethod = this.getHttpMethod(verb)
        let routeOptions: apigateway.AddRoutesOptions = {
          path: path,
          methods: [verbAsHttpMethod],
          integration: pickupGamesLambdaIntegration,
          authorizer: method[verb].security ? userPoolAuthorizer : undefined,
        };

        api.addRoutes(routeOptions);
        console.log(`Added ${verbAsHttpMethod} ${path}`);
      });
    }

    userPool.grant(gameSignupLambda, "cognito-idp:Admin*");
  }

  getHttpMethod(str: string) {
    switch (str.toUpperCase()) {
      case "GET":
        return apigateway.HttpMethod.GET;
      case "POST":
        return apigateway.HttpMethod.POST;
      case "PUT":
        return apigateway.HttpMethod.PUT;
      case "DELETE":
        return apigateway.HttpMethod.DELETE;
      case "PATCH":
        return apigateway.HttpMethod.PATCH;
      case "HEAD":
        return apigateway.HttpMethod.HEAD;
      default:
        return apigateway.HttpMethod.ANY;
    }
  }
}
