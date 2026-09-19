import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const helloLambda = new lambda.NodejsFunction(this, "HelloHandler", {
      entry: "lambda/hello.ts",
      handler: "handler",
    });

    const api = new apigateway.LambdaRestApi(this, "WaypointApi", {
      handler: helloLambda,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
  }
}