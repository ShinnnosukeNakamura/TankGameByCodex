import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const TABLE_NAME = process.env.TABLE_NAME || "";
const INDEX_NAME = process.env.INDEX_NAME || "";
const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || "main";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const MAX_NAME_LEN = 8;
const MAX_LIMIT = 50;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function response(statusCode: number, body: unknown = null) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    },
    body: body === null ? "" : JSON.stringify(body),
  };
}

function parseLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

export const handler = async (event: any) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

  if (method === "OPTIONS") {
    return response(204, null);
  }

  if (!TABLE_NAME || !INDEX_NAME) {
    return response(500, { message: "Server not configured" });
  }

  if (method === "GET") {
    const params = event?.queryStringParameters ?? {};
    const limit = parseLimit(params.limit);
    const boardId = (params.boardId || DEFAULT_BOARD_ID).trim() || DEFAULT_BOARD_ID;

    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: INDEX_NAME,
        KeyConditionExpression: "boardId = :boardId",
        ExpressionAttributeValues: {
          ":boardId": boardId,
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    const items = (result.Items ?? []).map((item) => ({
      name: String(item.name || "名無し").slice(0, MAX_NAME_LEN),
      score: Number(item.score ?? 0),
      floor: Number(item.floor ?? 1),
      createdAt: item.createdAt,
    }));

    return response(200, { items });
  }

  if (method === "POST") {
    let body: any = {};
    try {
      body = event?.body ? JSON.parse(event.body) : {};
    } catch (error) {
      return response(400, { message: "Invalid JSON" });
    }

    const rawName = String(body.name ?? "").trim();
    const name = rawName.slice(0, MAX_NAME_LEN);
    const score = Number(body.score ?? NaN);
    const floor = Number(body.floor ?? 1);
    const boardId = String(body.boardId || DEFAULT_BOARD_ID).trim() || DEFAULT_BOARD_ID;

    if (!name) {
      return response(400, { message: "Name is required" });
    }
    if (!Number.isFinite(score) || score < 0) {
      return response(400, { message: "Score is invalid" });
    }

    const entryId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          entryId,
          boardId,
          name,
          score,
          floor: Number.isFinite(floor) ? floor : 1,
          createdAt,
        },
      })
    );

    return response(201, { entryId, createdAt });
  }

  return response(405, { message: "Method Not Allowed" });
};
