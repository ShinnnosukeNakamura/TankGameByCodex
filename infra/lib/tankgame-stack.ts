import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

export class TankGameStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const allowedOrigin = this.node.tryGetContext("allowedOrigin") || "*";

    const table = new dynamodb.Table(this, "LeaderboardTable", {
      partitionKey: { name: "entryId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: "board-score-index",
      partitionKey: { name: "boardId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "score", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const handler = new NodejsFunction(this, "LeaderboardHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../lambda/leaderboard.ts"),
      handler: "handler",
      memorySize: 128,
      timeout: cdk.Duration.seconds(6),
      environment: {
        TABLE_NAME: table.tableName,
        INDEX_NAME: "board-score-index",
        DEFAULT_BOARD_ID: "main",
        ALLOWED_ORIGIN: allowedOrigin,
      },
      bundling: {
        minify: true,
        sourceMap: false,
        target: "es2020",
      },
    });

    table.grantReadWriteData(handler);

    const httpApi = new apigwv2.HttpApi(this, "LeaderboardApi", {
      corsPreflight: {
        allowHeaders: ["Content-Type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: [allowedOrigin],
      },
    });

    const integration = new apigwv2Integrations.HttpLambdaIntegration(
      "LeaderboardIntegration",
      handler
    );

    httpApi.addRoutes({
      path: "/leaderboard",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration,
    });

    new cdk.CfnOutput(this, "LeaderboardApiUrl", {
      value: httpApi.url ?? "",
    });

    new cdk.CfnOutput(this, "LeaderboardTableName", {
      value: table.tableName,
    });
  }
}
