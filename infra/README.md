# TankGame Infrastructure

このディレクトリはランキングAPIのAWS CDKスタックです。

## 構成
- DynamoDB (オンデマンド)
- Lambda (Leaderboard API)
- API Gateway HTTP API

## 使い方
```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy -c allowedOrigin=https://<AMPLIFYのドメイン>
```

`allowedOrigin` は CORS の許可オリジンです。開発中は `*` を使えますが、本番は Amplify のドメインに絞るのがおすすめです。

デプロイ後に `LeaderboardApiUrl` が出力されます。
`config.js` の `API_BASE_URL` に設定してください。

## エンドポイント
- `GET /leaderboard?limit=10&boardId=main`
- `POST /leaderboard` (body: `{ "name": "AAA", "score": 123, "floor": 4, "boardId": "main" }`)
