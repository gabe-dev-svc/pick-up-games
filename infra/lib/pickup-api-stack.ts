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
import * as s3 from "aws-cdk-lib/aws-s3";

export interface PickupApiStackProps extends cdk.StackProps {
  readonly pickupGamesDeploymentBucketName: string;
}

export class PickupApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PickupApiStackProps) {
    super(scope, id, props);
    const pickupGamesDeploymentBucket = s3.Bucket.fromBucketName(
      this,
      "PickupGamesAPIArtifactsBucket",
      props.pickupGamesDeploymentBucketName
    );
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
      },
    });
    // create new DynamoDB table called PickupGames with a parition key of 'GameID' and a sort key of 'StartTime'
    const pickupGamesTable = new dynamodb.Table(this, "PickupGames", {
      partitionKey: { name: "GameID", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    // a tradeoff is being made where we cannot get all results in a single query.
    // the solution is to create a GSI on a known value and that will allow us to sort by the sort key, or get past/recent events
    pickupGamesTable.addGlobalSecondaryIndex({
      indexName: "SortedCategoryIndex",
      partitionKey: { name: "Category", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "StartTime", type: dynamodb.AttributeType.NUMBER },
    });
    // TODO: Better to have the artifacts uploaded and pulled from the bucket, but that requires a bit more work and I'd rather dedicate the time to more important features
    // Go Lambda responsible for all auth actions
    const gameAuthLambda = new lambda.Function(this, "GameAuthLambda", {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: "bootstrap",
      code: lambda.Code.fromAsset("../lambda/out/bin/pickupgamesapi.zip"),
      environment: {
        PICKUP_GAMES_TABLE: pickupGamesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        CLIENT_ID: userPoolClient.userPoolClientId,
      },
      timeout: cdk.Duration.seconds(4),
    });
    pickupGamesTable.grantReadWriteData(gameAuthLambda);

    // create API Gateway integration
    const pickupGamesAuthLambdaIntegration =
      new apigatewayintegrations.HttpLambdaIntegration(
        "PickupGamesAuthLambdaIntegration",
        gameAuthLambda
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
    const pickupGoApi = new apigateway.HttpApi(this, "PickupGamesAuthAPI", {
      createDefaultStage: true,
      defaultIntegration: pickupGamesAuthLambdaIntegration,
    });
    // read open api spec found in lib/resources/player-signups.json and create routes
    this.createApiRoutes(
      pickupGoApi,
      pickupGamesAuthLambdaIntegration,
      userPoolAuthorizer
    );
    userPool.grant(gameAuthLambda, "cognito-idp:Admin*");
  }

  // helper function to convert string to HttpMethod
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

  // helper function to create routes for the API Gateway derived from the OpenAPI spec
  createApiRoutes(
    api: apigateway.HttpApi,
    lambdaIntegration: apigatewayintegrations.HttpLambdaIntegration,
    userPoolAuthorizer: apigwauth.HttpUserPoolAuthorizer,
    pathPrefix: string = ""
  ) {
    const playerSignupsSpec = require("./resources/player-signups.json");
    if (pathPrefix && !pathPrefix.startsWith("/")) {
      pathPrefix = `/${pathPrefix}`;
    }
    for (let path in playerSignupsSpec.paths) {
      const method = playerSignupsSpec.paths[path];
      Object.keys(method).forEach((verb) => {
        let verbAsHttpMethod = this.getHttpMethod(verb);
        let routeOptions: apigateway.AddRoutesOptions = {
          path: pathPrefix ? `${pathPrefix}/${path}` : path,
          methods: [verbAsHttpMethod],
          integration: lambdaIntegration,
          authorizer: method[verb].security ? userPoolAuthorizer : undefined,
        };
        api.addRoutes(routeOptions);
        console.log(`Added ${verbAsHttpMethod} ${routeOptions.path}`);
      });
    }
  }

  // DEPRECATED: This function is no longer used, but I'm keeping it here for reference and for demonstrative purposes.
  // In a more professional, production-ready environment, I would remove this function.
  createJavaLambda(
    userPool: cognito.UserPool,
    pickupGamesTable: dynamodb.Table,
    userPoolClient: cognito.UserPoolClient
  ) {
    // create Lambda
    const gameSignupLambda = new lambda.Function(this, "GameSignupHandler", {
      runtime: lambda.Runtime.JAVA_11,
      handler: "com.pickupgames.App::handleRequest",
      code: lambda.Code.fromAsset("../lambda/out/bin/signups.jar"),
      environment: {
        PICKUP_GAMES_TABLE: pickupGamesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        CLIENT_ID: userPoolClient.userPoolClientId,
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
    });
    // create HttpUserPoolAuthorizer to authorize API requests
    const javaUserPoolAuthorizer = new apigwauth.HttpUserPoolAuthorizer(
      "PickupGamesJavaAPIAuthorizer",
      userPool,
      {
        userPoolClients: [userPoolClient],
      }
    );
    // create API Gateway integration and API
    const pickupGamesLambdaIntegration =
      new apigatewayintegrations.HttpLambdaIntegration(
        "PickupGamesIntegration",
        gameSignupLambda
      );
    const pickupJavaApi = new apigateway.HttpApi(this, "PickupGamesAPI", {
      createDefaultStage: true,
      defaultIntegration: pickupGamesLambdaIntegration,
    });
    // grant the Lambda read/write permissions to the pickup games table and to the user pool
    pickupGamesTable.grantReadWriteData(gameSignupLambda);
    userPool.grant(gameSignupLambda, "cognito-idp:Admin*");
    // create routes for the API
    this.createApiRoutes(
      pickupJavaApi,
      pickupGamesLambdaIntegration,
      javaUserPoolAuthorizer
    );
  }
}
