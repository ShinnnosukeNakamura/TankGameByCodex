# Ironcrawl Tanks

リアルタイムのローグライク風戦車ゲームです。30x30の市街地マップを探索し、出口（リフト）へ到達して次フロアへ進むことを目指します。

## 遊び方
1. `index.html` をブラウザで開きます。
2. キーボード操作で移動・射撃します。

## 操作
- 移動: 矢印キー / WASD
- 射撃: Space
- 一時停止: P または「一時停止」ボタン
- やり直し: R または「やり直し」ボタン

## ルール概要
- リアルタイム更新。
- 移動は4方向。
- 壁や瓦礫は通行不可。
- 敵がいるマスへは侵入不可。
- 視界はマンハッタン距離で7。
- 未探索マスは暗く、既視マスは薄暗く残る。
- 弾は現在の向きに直線で進み、壁または敵に当たるまで移動。
- 弾薬は1発消費。

## アイテム
- 弾薬箱: +4発
- 修理キット: HP +2（最大HPまで）

## 敵
- Scout: HP1
- Brute: HP2
- 直線射線が通ると射撃
- それ以外はプレイヤーに向かって移動

## スコア
- 敵撃破: +12
- フロア到達: +60

## ファイル構成
- `index.html`: 画面とUI
- `style.css`: 見た目
- `main.js`: 入口・ゲームループ
- `gameLogic.js`: 主要ロジック
- `SPEC.md`: 仕様メモ
- `config.js`: ランキングAPIの設定
- `infra/`: AWS CDK (DynamoDB + Lambda + API)

## ランキングAPI設定
`config.js` の `API_BASE_URL` に、CDKデプロイ後に出力されるAPI URLを設定してください。

## AWSデプロイ（CDK）
1. `infra/` に移動して依存関係をインストールします。
2. 初回のみ `cdk bootstrap` を実行します。
3. `cdk deploy` でデプロイします。

例:
```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy -c allowedOrigin=https://<AMPLIFYのドメイン>
```

デプロイ後に `LeaderboardApiUrl` が出力されるので、`config.js` に反映します。

## Amplify Hosting
このゲームは静的サイトなので、Amplify Hosting でそのままホストできます。
ビルドが不要な場合は、リポジトリのルートをデプロイ対象にしてください。

## ライセンス
未設定
