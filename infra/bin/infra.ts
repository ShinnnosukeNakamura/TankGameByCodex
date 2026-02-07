#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TankGameStack } from "../lib/tankgame-stack";

const app = new cdk.App();

new TankGameStack(app, "TankGameStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
