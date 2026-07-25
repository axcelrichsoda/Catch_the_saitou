# エラーロイド デジタル対戦版

市販の2人用正体隠匿系推理カードゲーム「エラーロイド」を、友人と2台のPCでリアルタイム対戦できるようにしたデジタル版。TypeScript npm workspacesモノレポ(`packages/shared` / `packages/server` / `packages/client`)。

- ルール: [`docs/rules.md`](./docs/rules.md)
- カード個別テキスト: [`docs/cards.md`](./docs/cards.md)
- 実装の経緯・技術方針・進捗ログ: [`pc-serene-marshmallow.md`](./pc-serene-marshmallow.md)

## 構成

```
packages/
  shared/   ドメイン型・カードデータ・効果DSL(client/server共通、ビルド成果物なしで参照可)
  server/   Express + Socket.io。ゲーム進行エンジン・部屋管理・秘匿マスク処理
  client/   Vite + React + zustand。盤面UI
```

## セットアップ

Node.js 20 LTS以降を推奨(バージョン固定ファイルは未整備)。

```
npm install
```

ワークスペース構成のため、ルートで一度installすれば3パッケージ分の依存が揃う。

## 開発時の起動

`shared`はビルド不要(サーバー・クライアントともソースを直接参照する`paths`設定済み)。`server`と`client`をそれぞれ別ターミナルで起動する。

```
# ターミナル1: サーバー(既定 http://localhost:3001)
cd packages/server
npm run dev

# ターミナル2: クライアント(既定 http://localhost:5173、Viteのデフォルト)
cd packages/client
npm run dev
```

クライアントからサーバーへの接続先は現状ハードコード/環境変数依存(`packages/client/src/socket.ts`参照)。ローカルでは既定値のままで動作する想定。

## ビルド

```
# 型チェック(shared+serverをproject referencesでビルド、distへも出力される)
npm run typecheck

# server単体でも同様に型チェックできる(実行には使わない、下記参照)
cd packages/server && npm run build

# client本体のビルド
cd packages/client && npm run build
```

`packages/shared`は`package.json`の`main`がソース(`src/index.ts`)を直接指しており、クライアントがVite経由でシンプルに参照できるようにする設計(sharedの変更がビルドなしで即座にclientへ反映される)。そのため server の実行(`dev`/`start`)は `tsc -b` の成果物(`dist/`)ではなく **`tsx`でTypeScriptソースを直接実行**する(`node dist/src/index.js`はshared側の解決に失敗するため不可)。`build`スクリプトは型チェックのゲートとして残しているだけで、実行には使わない。

## デプロイ(Render)

[`render.yaml`](./render.yaml) にBlueprint定義済み。Renderダッシュボードの「New +」→「Blueprint」でこのリポジトリを指定すると、以下2サービスがまとめて作成される。

- `erroroid-server`(Node Web Service、無料枠): サーバー本体。ビルドコマンド・起動コマンドは[開発時の起動](#開発時の起動)節と同じ考え方(`tsx`でソース直接実行)
- `erroroid-client`(Static Site): クライアントのビルド成果物(`packages/client/dist`)を配信

**デプロイ後に確認すること**

- `erroroid-client`の環境変数`VITE_SERVER_URL`は「サービス名がそのままサブドメインになる」前提で`https://erroroid-server.onrender.com`を仮設定している。Render側で名前が衝突し実際のURLが異なった場合は、正しいURLに書き換えて`erroroid-client`を再デプロイすること(Viteのビルド時埋め込み変数のため再ビルドが必要)
- CORS(`erroroid-server`のCLIENT_ORIGIN環境変数)は同じ理由で固定URLにせず既定の`*`のままにしている(認証Cookie等を使わない設計のため実害はない想定)。厳格にしたい場合は実際のclient URLを控えてserver側に環境変数として追加する

## テスト

```
npm run test
```

ルートのVitest設定で`shared`・`server`のユニット/統合テストをまとめて実行する(`packages/server/test/network`配下はモックソケット経由の統合テスト)。

## デプロイ・運用上の注意

`pc-serene-marshmallow.md`の技術方針より抜粋。

- デプロイ先: Render(`render.yaml`参照)。固定URLを共有するだけで友人が参加できる形を目指す
- Render無料枠は一定時間アクセスがないとスリープする。**対戦を始める前に一度URLを開いて起動を待つ**(コールドスタートで数十秒かかる場合がある)
- **対戦中にGitHubへpushすると自動デプロイでサーバープロセスが再起動し、進行中のGameStateが失われる**。対戦中の開発・pushは避けること
- ルーム保護は「ルームURLに推測困難なランダムトークンを付与」のみで、ログイン認証は無い(身内限定プレイを想定した軽量な設計)

## 既知の未実装・要確認事項

すべて実装をブロックするものではないが、実機での本番プレイ前に解消しておきたい項目。

**解消済み**

- 先攻/後攻はじゃんけん相当のランダム決定に変更済み(`Room.submitErroroidChoice`、rng注入によりテストは決定的)
- `Room.dispatch`を発生順に直列処理する排他制御を追加し、同時アクションの競合状態を解消(`packages/server/test/network/room.test.ts`に再現テストあり)
- クライアント側の心拍ping(4分間隔でサーバーの`GET /ping`を叩く)を実装(`packages/client/src/socket.ts`の`startHeartbeat`)
- クライアント側にaction応答待ち中の多重送信ガードを追加(`useGameStore`の`actionInFlight`、手札・アンドロイド・リヴィール・ターン終了ボタンを一時無効化)
- 全カード(アンドロイド7種・推理カード9種・リヴィール2種)の実物カード照合が完了し、`confidence`は全て`confirmed`(2026-07-25時点)。この過程で見つかった3件のロジックバグ(齋藤さん(弁護士)/lucasの1段目対象、齋藤さん(マジシャン)/oliverの常在トリガー範囲、痕跡発見の2段目対象)を修正済み。詳細は [`docs/cards.md`](./docs/cards.md) 参照
- キャラクター表示名を実物カード名(齋藤さん(探偵)/(弁護士)/(美大生)/(バーテンダー)/(メイド)/(マジシャン)/(猫))に更新(コード内部の識別子はcharlotte/lucas/ivy/ben/lillian/oliver/saintのまま維持、対応表は`docs/cards.md`参照)
- カード画像素材(`カードデザイン/`)を`packages/client/src/assets/cards/`に配置し、UIに実装済み(2026-07-25)。AndroidRow(盤面、オープン時はANDOROID/ERROROID裏面に切替)・Hand・RevealArea・Lobbyのキャラ選択・TargetSelectModal・DiscardSelectModal・相手の伏せ手札表示まで対応。画像自体に名前・コスト・効果テキストが焼き込まれているため、盤面カードとキャラ選択画面で重複していたテキスト表示(名前・コスト・効果文)は整理済み
- デプロイ設定(`render.yaml`)を作成済み(2026-07-26)。ルートに`build`スクリプトが無く本節の想定コマンドが実際には動かない不整合があったため、`npm run typecheck`を呼ぶ`build`スクリプトを追加して解消。詳細は[デプロイ(Render)](#デプロイrender)節参照

**要修正(コード側、未着手)**

- 実機2台での対戦確認は未着手(今回はPlaywrightで2ブラウザセッションの自動対戦テストのみ実施)
- カード画像は原寸(1枚あたり約2MB、21枚合計で約44MB)のまま実装しており、圧縮・リサイズは未対応。作業時点でこの環境にImageMagick/sharp等の画像処理ツールが無かったため見送った。ローカル対戦では支障ないが、Render無料枠にデプロイした場合は初回読み込みが重くなる可能性があり、本番投入前に圧縮を検討したい

**要確認(実物カード側)**

- カード効果テキストはすべて実物照合済み(上記参照)
