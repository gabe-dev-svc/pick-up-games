import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
export declare class PickupApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
    getHttpMethod(str: string): cdk.aws_apigatewayv2.HttpMethod.ANY | cdk.aws_apigatewayv2.HttpMethod.DELETE | cdk.aws_apigatewayv2.HttpMethod.GET | cdk.aws_apigatewayv2.HttpMethod.HEAD | cdk.aws_apigatewayv2.HttpMethod.PATCH | cdk.aws_apigatewayv2.HttpMethod.POST | cdk.aws_apigatewayv2.HttpMethod.PUT;
}
