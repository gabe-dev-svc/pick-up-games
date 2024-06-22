"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupApiStack = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const cognito = require("aws-cdk-lib/aws-cognito");
const apigateway = require("aws-cdk-lib/aws-apigatewayv2");
const apigatewayintegrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const apigwauth = require("aws-cdk-lib/aws-apigatewayv2-authorizers");
class PickupApiStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const pickupGamesLambdaIntegration = new apigatewayintegrations.HttpLambdaIntegration("PickupGamesIntegration", gameSignupLambda);
        // create HttpUserPoolAuthorizer for use with API Gateway
        const userPoolAuthorizer = new apigwauth.HttpUserPoolAuthorizer("PickupGamesAPIAuthorizer", userPool, {
            userPoolClients: [userPoolClient],
        });
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
                let verbAsHttpMethod = this.getHttpMethod(verb);
                let routeOptions = {
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
    getHttpMethod(str) {
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
exports.PickupApiStack = PickupApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlja3VwLWFwaS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBpY2t1cC1hcGktc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBR25DLHFEQUFxRDtBQUNyRCxpREFBaUQ7QUFFakQsbURBQW1EO0FBQ25ELDJEQUEyRDtBQUMzRCxvRkFBb0Y7QUFDcEYsc0VBQXNFO0FBRXRFLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsc0JBQXNCO1FBQ3RCLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3RELGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1NBQzVCLENBQUMsQ0FBQztRQUNILGlDQUFpQztRQUNqQyxNQUFNLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hFLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLGtCQUFrQixFQUFFLGdCQUFnQjtZQUNwQyxTQUFTLEVBQUU7Z0JBQ1QsaUJBQWlCLEVBQUUsSUFBSTthQUN4QjtTQUNGLENBQUMsQ0FBQztRQUNILDZHQUE2RztRQUM3RyxNQUFNLGdCQUFnQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQy9ELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3JFLE9BQU8sRUFBRSxFQUFF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SUFFRCxhQUFhLENBQUMsR0FBVztRQUN2QixRQUFRLEdBQUcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQzFCLEtBQUssS0FBSztnQkFDUixPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQ25DLEtBQUssTUFBTTtnQkFDVCxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ3BDLEtBQUssS0FBSztnQkFDUixPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1lBQ25DLEtBQUssUUFBUTtnQkFDWCxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ3RDLEtBQUssT0FBTztnQkFDVixPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO1lBQ3JDLEtBQUssTUFBTTtnQkFDVCxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ3BDO2dCQUNFLE9BQU8sVUFBVSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7UUFDckMsQ0FBQztJQUNILENBQUM7Q0FDRjtBQW5HRCx3Q0FtR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3FzXCI7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcbmltcG9ydCAqIGFzIGV2ZW50c291cmNlcyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzXCI7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2MlwiO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheWludGVncmF0aW9ucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mi1pbnRlZ3JhdGlvbnNcIjtcbmltcG9ydCAqIGFzIGFwaWd3YXV0aCBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mi1hdXRob3JpemVyc1wiO1xuXG5leHBvcnQgY2xhc3MgUGlja3VwQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgLy8gY3JlYXRlIG5ldyBVc2VyUG9vbFxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJVc2VyUG9vbFwiLCB7XG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgfSk7XG4gICAgLy8gY3JlYXRlIGFwcCBjbGllbnQgZm9yIFVzZXJQb29sXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50XCIsIHtcbiAgICAgIHVzZXJQb29sOiB1c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogXCJQaWNrdXBHYW1lc0FQSVwiLFxuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGNyZWF0ZSBuZXcgRHluYW1vREIgdGFibGUgY2FsbGVkIFBpY2t1cEdhbWVzIHdpdGggYSBwYXJpdGlvbiBrZXkgb2YgJ0dhbWVJRCcgYW5kIGEgc29ydCBrZXkgb2YgJ1N0YXJ0VGltZSdcbiAgICBjb25zdCBwaWNrdXBHYW1lc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiUGlja3VwR2FtZXNcIiwge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiR2FtZUlEXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwiU3RhcnRUaW1lXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgfSk7XG4gICAgLy8gYSB0cmFkZW9mZiBpcyBiZWluZyBtYWRlIHdoZXJlIHdlIGNhbm5vdCBnZXQgYWxsIHJlc3VsdHMgaW4gYSBzaW5nbGUgcXVlcnkuIFxuICAgIC8vIHRoZSBzb2x1dGlvbiBpcyB0byBjcmVhdGUgYSBHU0kgb24gYSBrbm93biB2YWx1ZSBhbmQgdGhhdCB3aWxsIGFsbG93IHVzIHRvIHNvcnQgYnkgdGhlIHNvcnQga2V5LCBvciBnZXQgcGFzdC9yZWNlbnQgZXZlbnRzXG4gICAgcGlja3VwR2FtZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6IFwiU29ydGVkQ2F0ZWdvcnlJbmRleFwiLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiQ2F0ZWdvcnlcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJTdGFydFRpbWVcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcbiAgICAvLyBjcmVhdGUgYSBHb0xhbmcgTGFtYmRhIGZ1bmN0aW9uIGNhbGxlZCAnR2FtZVNpZ251cEhhbmRsZXInIHRoYXQgd2lsbCBiZSB0cmlnZ2VyZWQgYnkgdGhlICdHYW1lU2lnbnVwcycgU1FTIHF1ZXVlIGFuZCB3aWxsIHdyaXRlIHRvIHRoZSAnUGlja3VwR2FtZXMnIER5bmFtb0RCIHRhYmxlXG4gICAgY29uc3QgZ2FtZVNpZ251cExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJHYW1lU2lnbnVwSGFuZGxlclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIwMjMsXG4gICAgICBoYW5kbGVyOiBcImJvb3RzdHJhcFwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwiLi4vbGFtYmRhL291dC9iaW4vcGlja3VwZ2FtZXNhcGkuemlwXCIpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUElDS1VQX0dBTUVTX1RBQkxFOiBwaWNrdXBHYW1lc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDTElFTlRfSUQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHBpY2t1cEdhbWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdhbWVTaWdudXBMYW1iZGEpO1xuICAgIC8vIGNyZWF0ZSBBUEkgR2F0ZXdheSBpbnRlZ3JhdGlvblxuICAgIGNvbnN0IHBpY2t1cEdhbWVzTGFtYmRhSW50ZWdyYXRpb24gPVxuICAgICAgbmV3IGFwaWdhdGV3YXlpbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKFxuICAgICAgICBcIlBpY2t1cEdhbWVzSW50ZWdyYXRpb25cIixcbiAgICAgICAgZ2FtZVNpZ251cExhbWJkYVxuICAgICAgKTtcbiAgICAvLyBjcmVhdGUgSHR0cFVzZXJQb29sQXV0aG9yaXplciBmb3IgdXNlIHdpdGggQVBJIEdhdGV3YXlcbiAgICBjb25zdCB1c2VyUG9vbEF1dGhvcml6ZXIgPSBuZXcgYXBpZ3dhdXRoLkh0dHBVc2VyUG9vbEF1dGhvcml6ZXIoXG4gICAgIFwiUGlja3VwR2FtZXNBUElBdXRob3JpemVyXCIsXG4gICAgIHVzZXJQb29sLFxuICAgICB7XG4gICAgICB1c2VyUG9vbENsaWVudHM6IFt1c2VyUG9vbENsaWVudF0sXG4gICAgIH1cbiAgICApO1xuICAgIC8vIGNyZWF0ZSBuZXcgQVBJIEdhdGV3YXkgd2l0aCBhIGRlZmF1bHQgc3RhZ2UgYW5kIHRoZSAnUGlja3VwR2FtZXNBUEknIGludGVncmF0aW9uICBcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5IdHRwQXBpKHRoaXMsIFwiUGlja3VwR2FtZXNBUElcIiwge1xuICAgICAgY3JlYXRlRGVmYXVsdFN0YWdlOiB0cnVlLFxuICAgICAgZGVmYXVsdEludGVncmF0aW9uOiBwaWNrdXBHYW1lc0xhbWJkYUludGVncmF0aW9uLFxuICAgIH0pO1xuICAgIC8vIHJlYWQgb3BlbiBhcGkgc3BlYyBmb3VuZCBpbiBsaWIvcmVzb3VyY2VzL3BsYXllci1zaWdudXBzLmpzb24gYW5kIGNyZWF0ZSByb3V0ZXNcbiAgICBjb25zdCBwbGF5ZXJTaWdudXBzU3BlYyA9IHJlcXVpcmUoXCIuL3Jlc291cmNlcy9wbGF5ZXItc2lnbnVwcy5qc29uXCIpO1xuICAgIGZvciAobGV0IHBhdGggaW4gcGxheWVyU2lnbnVwc1NwZWMucGF0aHMpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IHBsYXllclNpZ251cHNTcGVjLnBhdGhzW3BhdGhdO1xuICAgICAgT2JqZWN0LmtleXMobWV0aG9kKS5mb3JFYWNoKCh2ZXJiKSA9PiB7XG4gICAgICAgIGxldCB2ZXJiQXNIdHRwTWV0aG9kID0gdGhpcy5nZXRIdHRwTWV0aG9kKHZlcmIpXG4gICAgICAgIGxldCByb3V0ZU9wdGlvbnM6IGFwaWdhdGV3YXkuQWRkUm91dGVzT3B0aW9ucyA9IHtcbiAgICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICAgIG1ldGhvZHM6IFt2ZXJiQXNIdHRwTWV0aG9kXSxcbiAgICAgICAgICBpbnRlZ3JhdGlvbjogcGlja3VwR2FtZXNMYW1iZGFJbnRlZ3JhdGlvbixcbiAgICAgICAgICBhdXRob3JpemVyOiBtZXRob2RbdmVyYl0uc2VjdXJpdHkgPyB1c2VyUG9vbEF1dGhvcml6ZXIgOiB1bmRlZmluZWQsXG4gICAgICAgIH07XG5cbiAgICAgICAgYXBpLmFkZFJvdXRlcyhyb3V0ZU9wdGlvbnMpO1xuICAgICAgICBjb25zb2xlLmxvZyhgQWRkZWQgJHt2ZXJiQXNIdHRwTWV0aG9kfSAke3BhdGh9YCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB1c2VyUG9vbC5ncmFudChnYW1lU2lnbnVwTGFtYmRhLCBcImNvZ25pdG8taWRwOkFkbWluKlwiKTtcbiAgfVxuXG4gIGdldEh0dHBNZXRob2Qoc3RyOiBzdHJpbmcpIHtcbiAgICBzd2l0Y2ggKHN0ci50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICBjYXNlIFwiR0VUXCI6XG4gICAgICAgIHJldHVybiBhcGlnYXRld2F5Lkh0dHBNZXRob2QuR0VUO1xuICAgICAgY2FzZSBcIlBPU1RcIjpcbiAgICAgICAgcmV0dXJuIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QT1NUO1xuICAgICAgY2FzZSBcIlBVVFwiOlxuICAgICAgICByZXR1cm4gYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBVVDtcbiAgICAgIGNhc2UgXCJERUxFVEVcIjpcbiAgICAgICAgcmV0dXJuIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5ERUxFVEU7XG4gICAgICBjYXNlIFwiUEFUQ0hcIjpcbiAgICAgICAgcmV0dXJuIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QQVRDSDtcbiAgICAgIGNhc2UgXCJIRUFEXCI6XG4gICAgICAgIHJldHVybiBhcGlnYXRld2F5Lkh0dHBNZXRob2QuSEVBRDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBhcGlnYXRld2F5Lkh0dHBNZXRob2QuQU5ZO1xuICAgIH1cbiAgfVxufVxuIl19