# 設計

## 目次

- [概要](#概要)
- [ページ構成](#ページ構成)
    - [`/`](#-root) - トップページ
    - [`/signup`](#signup) - アカウント登録メール送信ページ
    - [`/signup/complete?token={signup_session_token}`](#signupcompletetokensignup_session_token) - アカウント登録完了ページ
    - [`/login`](#login) - ログインページ（MFA対応）
    - [`/password-reset`](#password-reset) - パスワードリセット申請ページ
    - [`/password-reset/complete?token={password_reset_token}`](#password-resetcompletetokenpassword_reset_token) - パスワードリセット完了ページ
    - [`/settings`](#settings) - ユーザー設定ページ（MFA管理含む）
    - [`/email-change/complete?token={email_change_token}`](#email-changecompletetokenemail_change_token) - メールアドレス変更完了ページ
- [APIエンドポイント](#apiエンドポイント)
    - [ミドルウェア `loginRequired`](#ミドルウェア-loginrequired) - 認証確認ミドルウェア
    - [`POST /api/v1/signup`](#post-apiv1signup) - アカウント登録申請
    - [`POST /api/v1/signup/complete`](#post-apiv1signupcomplete) - アカウント登録完了
    - [`POST /api/v1/login`](#post-apiv1login) - ログイン（メール・パスワード）
    - [`POST /api/v1/login/mfa/totp`](#post-apiv1loginmfatotp) - TOTPコード認証
    - [`POST /api/v1/login/mfa/totp/backup-code`](#post-apiv1loginmfatotpbackup-code) - TOTPバックアップコード認証
    - [`POST /api/v1/login/mfa/email-otp`](#post-apiv1loginmfaemail-otp) - Email OTPコード送信
    - [`POST /api/v1/login/mfa/email-otp/backup-code`](#post-apiv1loginmfaemail-otpbackup-code) - Email OTPバックアップコード認証
    - [`POST /api/v1/login/mfa/email-otp/complete`](#post-apiv1loginmfaemail-otpcomplete) - Email OTPコード認証
    - [`POST /api/v1/logout`](#post-apiv1logout) - ログアウト
    - [`POST /api/v1/password-reset`](#post-apiv1password-reset) - パスワードリセット申請
    - [`POST /api/v1/password-reset/complete`](#post-apiv1password-resetcomplete) - パスワードリセット完了
    - [`POST /api/v1/password-change`](#post-apiv1userspassword-change) - パスワード変更
    - [`POST /api/v1/email-change`](#post-apiv1usersemail-change) - メールアドレス変更申請
    - [`POST /api/v1/email-change/complete`](#post-apiv1usersemail-changecomplete) - メールアドレス変更完了
    - [`POST /api/v1/mfa/totp/enable`](#post-apiv1mfatotpenable) - TOTP MFA有効化開始
    - [`POST /api/v1/mfa/totp/enable/complete`](#post-apiv1mfatotpenablecomplete) - TOTP MFA有効化完了
    - [`POST /api/v1/mfa/totp/disable`](#post-apiv1mfatotpdisable) - TOTP MFA無効化
    - [`GET /api/v1/mfa/totp/backup-codes`](#get-apiv1mfatotpbackup-codes) - TOTPバックアップコード取得
    - [`POST /api/v1/mfa/totp/backup-codes/regenerate`](#post-apiv1mfatotpbackup-codesregenerate) - TOTPバックアップコード再生成
    - [`POST /api/v1/mfa/email-otp/enable`](#post-apiv1mfaemail-otpenable) - Email OTP MFA有効化開始
    - [`POST /api/v1/mfa/email-otp/enable/complete`](#post-apiv1mfaemail-otpenablecomplete) - Email OTP MFA有効化完了
    - [`POST /api/v1/mfa/email-otp/disable`](#post-apiv1mfaemail-otpdisable) - Email OTP MFA無効化開始
    - [`POST /api/v1/mfa/email-otp/disable/complete`](#post-apiv1mfaemail-otpdisablecomplete) - Email OTP MFA無効化完了
    - [`GET /api/v1/mfa/email-otp/backup-codes`](#get-apiv1mfaemail-otpbackup-codes) - Email OTPバックアップコード取得
    - [`POST /api/v1/mfa/email-otp/backup-codes/regenerate`](#post-apiv1mfaemail-otpbackup-codesregenerate) - Email OTPバックアップコード再生成
    - [`GET /api/v1/users/me`](#get-apiv1usersme) - ユーザー情報取得
    - [`GET /api/v1/sessions`](#get-apiv1sessions) - セッション一覧取得
    - [`DELETE /api/v1/sessions/:sessionId`](#delete-apiv1sessionssessionid) - セッション削除
    - [`DELETE /api/v1/users/me`](#delete-apiv1usersme) - アカウント削除
- [DB](#db)
  - [`users`](#users)
  - [`deleted_users`](#deleted_users)
  - [`signup_sessions`](#signup_sessions)
  - [`login_sessions`](#login_sessions)
  - [`password_reset_sessions`](#password_reset_sessions)
  - [`email_change_sessions`](#email_change_sessions)
  - [`mfa_totp_enable_sessions`](#mfa_totp_enable_sessions)
  - [`mfa_email_otp_enable_sessions`](#mfa_email_otp_enable_sessions)
  - [`mfa_totp_login_sessions`](#mfa_totp_login_sessions)
  - [`mfa_email_otp_login_sessions`](#mfa_email_otp_login_sessions)
  - [`mfa_email_otp_disable_sessions`](#mfa_email_otp_disable_sessions)
  - [`mfa_totp_backup_codes`](#mfa_totp_backup_codes)
  - [`mfa_email_otp_backup_codes`](#mfa_email_otp_backup_codes)

## 概要
- アクセストークンはJWTでクッキーに保存し、有効期限は15分とする
    - `sub` : `users.id`
- ログイン状態を維持する場合、リフレッシュトークンをクッキーに保存し、有効期限は31日とする
    - DBにも登録する
    - アクセストークンの再発行時にリフレッシュトークンも再発行する

[目次に戻る](#目次)

## ページ構成

### `/ (root)`
- ページ読み込み時に `GET /api/v1/users/me` を呼び出してユーザー情報を取得
    - 認証済みの場合: ユーザー情報を表示
    - 未認証の場合: `/login` へリダイレクト（または未認証UI表示）

[目次に戻る](#目次)

### `/signup`
- Eメールアドレス入力欄
- アカウント登録用URLを送信するボタン
    - `POST /api/v1/signup` に `{ email: string; }` を送信

[目次に戻る](#目次)

### `/signup/complete?token={signup_session_token}`
- パスワード入力欄
- アカウントを登録するボタン
- ログイン状態を維持するチェックボックス
    - `POST /api/v1/signup/complete` に `{ token: string; password: string; rememberMe: boolean; }` を送信

[目次に戻る](#目次)

### `/login`
- **ステップ1: メール・パスワード入力**
    - Eメールアドレス入力欄
    - パスワード入力欄
    - ログイン状態を維持するチェックボックス
    - ログインボタン
        - `POST /api/v1/login` に `{ email: string; password: string; rememberMe: boolean; }` を送信
    - パスワードを忘れた方はこちら -> `/password-reset` へのリンク
- **ステップ2: TOTP MFA認証（TOTP MFAが有効な場合のみ表示）**
    - ステップ1のレスポンスで `mfaRequired: true` かつ `mfaTotp: true` の場合に表示
    - **TOTPコード入力モード（デフォルト）:**
        - 6桁のコード入力欄
        - ログインボタン
            - `POST /api/v1/login/mfa/totp` に `{ mfaTotpLoginSessionToken: string; code: string; }` を送信
        - 「バックアップコードを使う」リンク -> 入力モード切り替え
    - **TOTPバックアップコード入力モード:**
        - バックアップコード入力欄
        - ログインボタン
            - `POST /api/v1/login/mfa/totp/backup-code` に `{ mfaTotpLoginSessionToken: string; code: string; }` を送信
        - 「TOTPコードを使う」リンク -> 入力モード切り替え
    - TOTP認証完了後、Email OTP MFAも有効な場合はステップ3へ進む
- **ステップ3: Email OTP MFA認証（Email OTP MFAが有効な場合のみ表示）**
    - TOTP MFAが無効でEmail OTP MFAのみ有効: ステップ1のレスポンスで `mfaRequired: true` かつ `mfaEmailOtp: true` の場合
    - TOTP MFAとEmail OTP MFA両方有効: ステップ2完了後に表示
    - ページ表示時に自動的に `POST /api/v1/login/mfa/email-otp` を呼び出してOTPコードをメール送信
    - **Email OTPコード入力モード（デフォルト）:**
        - メッセージ表示: 「認証コードをメールで送信しました」
        - 6桁のコード入力欄
        - ログインボタン
            - `POST /api/v1/login/mfa/email-otp/complete` に `{ mfaEmailOtpLoginSessionToken: string; code: string; }` を送信
        - 「コードを再送信」リンク
            - `POST /api/v1/login/mfa/email-otp` を呼び出し
            - 成功メッセージ: 「認証コードを再送信しました」
        - 「バックアップコードを使う」リンク -> 入力モード切り替え
    - **Email OTPバックアップコード入力モード:**
        - バックアップコード入力欄
        - ログインボタン
            - `POST /api/v1/login/mfa/email-otp/backup-code` に `{ mfaEmailOtpLoginSessionToken: string; code: string; }` を送信
        - 「Email OTPコードを使う」リンク -> 入力モード切り替え

[目次に戻る](#目次)

### `/password-reset`
- Eメールアドレス入力欄
- パスワードリセット用URLを送信するボタン
    - `POST /api/v1/password-reset` に `{ email: string; }` を送信

[目次に戻る](#目次)

### `/password-reset/complete?token={password_reset_token}`
- 新しいパスワード入力欄
- 新しいパスワード確認入力欄
- パスワードを設定するボタン
    - `POST /api/v1/password-reset/complete` に `{ token: string; newPassword: string; }` を送信

[目次に戻る](#目次)

### `/settings`
- TOTP MFA管理セクション
    - ページ読み込み時に `GET /api/v1/users/me` から `mfaTotpEnabled` を取得
    - **TOTP MFA無効時:**
        - セクションタイトル: 「認証アプリ（TOTP）」
        - ステータス表示: 「無効」
        - 「TOTP MFAを有効化」ボタン
        - クリックでモーダル表示:
            - ステップ1: `POST /api/v1/mfa/totp/enable` を呼び出し
                - QRコード表示（otpauth URIから生成）
                - シークレットキー表示（手動入力用）
                - 認証アプリの説明
            - ステップ2: 6桁の確認コード入力欄
                - `POST /api/v1/mfa/totp/enable/complete` に `{ mfaTotpEnableSessionToken: string; code: string; }` を送信
            - ステップ3: バックアップコード表示（10個）
                - ダウンロードボタン
                - 印刷ボタン
                - 「保存しました」確認チェックボックス
    - **TOTP MFA有効時:**
        - セクションタイトル: 「認証アプリ（TOTP）」
        - ステータス表示: 「有効」
        - バックアップコード管理:
            - 使用状況表示（例: 「8/10 unused」）
            - 「バックアップコードを表示」ボタン -> モーダル表示
                - `GET /api/v1/mfa/totp/backup-codes` で使用状況一覧取得
                - 個別コードの使用済み/未使用表示（一部マスク）
            - 「バックアップコードを再生成」ボタン
                - `POST /api/v1/mfa/totp/backup-codes/regenerate` を呼び出し
                - 警告: 「現在のコードは全て使えなくなります」
                - 新しいコード一覧表示（ダウンロード/印刷可能）
        - 「TOTP MFAを無効化」ボタン -> 確認モーダル
            - 現在のパスワード入力
            - TOTPコード入力（6桁）
            - `POST /api/v1/mfa/totp/disable` に `{ password: string; code: string; }` を送信
- Email OTP MFA管理セクション
    - ページ読み込み時に `GET /api/v1/users/me` から `mfaEmailOtpEnabled` を取得
    - **Email OTP MFA無効時:**
        - セクションタイトル: 「メール認証（Email OTP）」
        - ステータス表示: 「無効」
        - 「Email OTP MFAを有効化」ボタン
        - クリックでモーダル表示:
            - ステップ1: `POST /api/v1/mfa/email-otp/enable` を呼び出し
                - メッセージ表示: 「認証コードをメールで送信しました」
                - 6桁の確認コード入力欄
                - 「コードを再送信」リンク
                    - 再度 `POST /api/v1/mfa/email-otp/enable` を呼び出し
            - ステップ2: コード検証
                - `POST /api/v1/mfa/email-otp/enable/complete` に `{ mfaEmailOtpEnableSessionToken: string; code: string; }` を送信
            - ステップ3: バックアップコード表示（10個）
                - ダウンロードボタン
                - 印刷ボタン
                - 「保存しました」確認チェックボックス
    - **Email OTP MFA有効時:**
        - セクションタイトル: 「メール認証（Email OTP）」
        - ステータス表示: 「有効」
        - バックアップコード管理:
            - 使用状況表示（例: 「8/10 unused」）
            - 「バックアップコードを表示」ボタン -> モーダル表示
                - `GET /api/v1/mfa/email-otp/backup-codes` で使用状況一覧取得
                - 個別コードの使用済み/未使用表示（一部マスク）
            - 「バックアップコードを再生成」ボタン
                - `POST /api/v1/mfa/email-otp/backup-codes/regenerate` を呼び出し
                - 警告: 「現在のコードは全て使えなくなります」
                - 新しいコード一覧表示（ダウンロード/印刷可能）
        - 「Email OTP MFAを無効化」ボタン -> 確認モーダル
            - ステップ1: パスワード入力とOTP送信
                - 現在のパスワード入力
                - 「無効化コードを送信」ボタン
                    - `POST /api/v1/mfa/email-otp/disable` に `{ password: string; }` を送信
                - メッセージ表示: 「認証コードをメールで送信しました」
            - ステップ2: コード検証と無効化
                - Email OTPコード入力（6桁）
                - 「コードを再送信」リンク
                - `POST /api/v1/mfa/email-otp/disable/complete` に `{ mfaEmailOtpDisableSessionToken: string; code: string; }` を送信
- セッション管理セクション
    - ページ読み込み時に `GET /api/v1/sessions` を呼び出してセッション一覧を取得
    - 各セッションの表示項目:
        - デバイス/ブラウザ情報
        - 作成日時
        - 最終アクセス日時
        - 現在のセッションの識別表示
    - 各セッションに削除ボタン
        - `DELETE /api/v1/sessions/:sessionId` を呼び出し
- メールアドレス変更セクション
    - 現在のメールアドレス表示
    - 新しいメールアドレス入力欄
    - 確認メールを送信するボタン
        - `POST /api/v1/email-change` に `{ newEmail: string; }` を送信
- パスワード変更セクション
    - 現在のパスワード入力欄
    - 新しいパスワード入力欄
    - 新しいパスワード確認入力欄
    - パスワード変更ボタン
        - `POST /api/v1/password-change` に `{ currentPassword: string; newPassword: string; }` を送信
- アカウント削除ボタン
    - `DELETE /api/v1/users/me` に `{}` を送信
- ログアウトボタン
    - `POST /api/v1/logout` に `{ scope: "current" | "others" | "all"; }` を送信

[目次に戻る](#目次)

### `/email-change/complete?token={email_change_token}`
- メールアドレス変更を完了するページ
- ページ読み込み時に `POST /api/v1/email-change/complete` に `{ token: string; }` を送信
- 変更完了メッセージ表示

[目次に戻る](#目次)

## APIエンドポイント

### ミドルウェア `loginRequired`

```ts
interface Cookie {
  access_token?: string;
  refresh_token?: string;
}

interface Context {
  userId: string;
}
```

1. クッキーからアクセストークンを取得
    - アクセストークンが存在しない場合は、ステップ4へ
2. アクセストークンを検証
    - 署名が無効な場合は `401 Unauthorized` を返却
    - トークンの形式が不正な場合は `401 Unauthorized` を返却
3. アクセストークンが有効な場合:
    - `sub` を取得してコンテキストに `userId` として設定
    - 次のハンドラーへ処理を継続
4. アクセストークンが期限切れ、または存在しない場合:
    - クッキーからリフレッシュトークンを取得
    - リフレッシュトークンが存在しない場合は `401 Unauthorized` を返却
5. リフレッシュトークンのハッシュ値で `login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `401 Unauthorized` を返却
6. 新しいアクセストークンを生成してクッキーに設定
    - `sub` : `login_sessions.user_id`
    - 有効期限: 15分
7. 新しいリフレッシュトークンを生成
8. `login_sessions` のレコードを更新
    - `refresh_token_hash` を新しいハッシュ値に更新
    - `expire_at` を延長（31日後）
9. 新しいリフレッシュトークンをクッキーに設定
10. ユーザーIDをコンテキストに設定
11. 次のハンドラーへ処理を継続

[目次に戻る](#目次)

### `POST /api/v1/signup`

```ts
interface Request {
  email: string;
}

interface Response {
  // なし
}
```

1. メールアドレスのバリデーション
    - メールアドレスが不正な場合は `400 Bad Request` を返却
2. 既存ユーザーチェック
    - 既に登録済みのメールアドレスであれば `409 Conflict` を返却
    - `deleted_users` に存在する場合:
        - `reregistration_allowed_at` が未来の場合は `409 Conflict` を返却（再登録不可期間中）
        - `reregistration_allowed_at` が過去の場合は登録を許可（再登録可能）
    - 有効期限内のサインアップセッションがあれば `429 Too Many Request` を返却
3. `signup_session_token` （ランダム文字列）を生成
4. `signup_sessions` にレコードを作成（有効期限: 24時間）
5. 登録用URL（ `/signup/complete?token={signup_session_token}` ）をメール送信
6. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/signup/complete`

```ts
interface Request {
  token: string;
  password: string;
  rememberMe?: boolean;
}

interface Response {
  // なし
}

interface Cookie {
  access_token: string;
  refresh_token?: string;
}
```

1. `request.token` のハッシュ値で `signup_sessions.signup_session_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. パスワードのバリデーションを実施
    - 要件を満たさない場合は `400 Bad Request` を返却
3. `salt` を生成
4. パスワードをハッシュ化
5. `users` テーブルにユーザーを作成
6. `signup_sessions` からレコードを削除
7. アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
    - `sub` : `users.id`
8. `request.rememberMe` が `true` の場合:
    - リフレッシュトークンを生成
    - `login_sessions` にレコードを作成（有効期限31日）
    - リフレッシュトークンをクッキーに設定
9. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/login`

```ts
interface Request {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface Response {
  mfaTotpLoginSessionToken?: string;
  mfaEmailOtpLoginSessionToken?: string;
}

interface Cookie {
  access_token?: string;
  refresh_token?: string;
}
```

1. メールアドレスで `users` からユーザーを検索
    - ユーザーが存在しない場合は `401 Unauthorized` を返却
2. パスワードをハッシュ化して照合
    - パスワードが一致しない場合は `401 Unauthorized` を返却
    - 認証失敗の試行回数をカウント（レート制限）
    - 試行回数が制限を超えた場合は `429 Too Many Requests` を返却
3. ユーザーの `mfa_email_otp_enabled` または `mfa_totp_enabled` を確認
4. **MFAが有効な場合（いずれかのMFA方式が有効）:**
    - `mfa_login_session_token` （ランダム文字列）を生成
    - ユーザーの有効なMFA方式に応じてセッションを作成（有効期限: 5分）
        - TOTP有効の場合: `mfa_totp_login_sessions` にレコードを作成
        - Email OTP有効の場合: `mfa_email_otp_login_sessions` にレコードを作成し、OTPコードを生成・メール送信
        - 両方有効の場合: 両方のテーブルにレコードを作成（ユーザーがどちらの方式でも認証可能）
        - `user_id` `remember_me` を保存
    - `200 OK` を返却
        - `mfaTotpLoginSessionToken` : TOTPログインセッショントークン(有効な場合のみ)
        - `mfaEmailOtpLoginSessionToken` : Email OTPログインセッショントークン(有効な場合のみ)
5. **MFAが無効な場合:**
    - アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
        - `sub` : `users.id`
    - `request.rememberMe` が `true` の場合:
        - リフレッシュトークンを生成
        - `login_sessions` にレコードを作成（有効期限31日）
        - リフレッシュトークンをクッキーに設定
    - `200 OK` を返却

### `POST /api/v1/login/mfa/totp`

```ts
interface Request {
  mfaTotpLoginSessionToken: string;
  code: string;
}

interface Response {
  // なし
}

interface Cookie {
  access_token: string;
  refresh_token?: string;
}
```

1. `request.mfaTotpLoginSessionToken` のハッシュ値で `mfa_totp_login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. セッションから `user_id` を取得してユーザー情報を検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
3. `request.code` のバリデーション
    - 6桁の数字でない場合は `400 Bad Request` を返却
4. ユーザーの `mfa_totp_secret` を使用してTOTPコードを検証
    - コードが不正な場合は `401 Unauthorized` を返却
5. アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
    - `sub` : `users.id`
6. セッションの `remember_me` が `true` の場合:
    - リフレッシュトークンを生成
    - `login_sessions` にレコードを作成（有効期限31日）
    - リフレッシュトークンをクッキーに設定
7. `mfa_totp_login_sessions` からレコードを削除
8. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/login/mfa/totp/backup-code`

```ts
interface Request {
  mfaTotpLoginSessionToken: string;
  code: string;
}

interface Response {
  // なし
}

interface Cookie {
  access_token: string;
  refresh_token?: string;
}
```

1. `request.mfaTotpLoginSessionToken` のハッシュ値で `mfa_totp_login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. セッションから `user_id` を取得してユーザー情報を検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
3. `mfa_totp_backup_codes` からユーザーのバックアップコードを検索
4. `request.code` をハッシュ化して `backup_code_hash` と照合
    - 一致するコードが存在しない場合は `401 Unauthorized` を返却
    - 既に使用済み（`used = true`）の場合は `401 Unauthorized` を返却
5. バックアップコードを使用済みとしてマーク:
    - `used` = `true`
    - `used_at` = 現在日時
6. アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
    - `sub` : `users.id`
7. セッションの `remember_me` が `true` の場合:
    - リフレッシュトークンを生成
    - `login_sessions` にレコードを作成（有効期限31日）
    - リフレッシュトークンをクッキーに設定
8. `mfa_totp_login_sessions` からレコードを削除
9. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/login/mfa/email-otp`

```ts
interface Request {
  mfaEmailOtpLoginSessionToken: string;
}

interface Response {
  // なし
}
```

1. `request.mfaEmailOtpLoginSessionToken` のハッシュ値で `mfa_email_otp_login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. セッションから `user_id` を取得してユーザー情報を検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
3. 新しいEmail OTPコードを生成（6桁の数字）
4. セッションの `otp_code_hash` を新しいコードのハッシュ値で更新
5. セッションの有効期限を延長（5分）
6. ユーザーのメールアドレスにOTPコードを送信
7. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/login/mfa/email-otp/backup-code`

```ts
interface Request {
  mfaEmailOtpLoginSessionToken: string;
  code: string;
}

interface Response {
  // なし
}

interface Cookie {
  access_token: string;
  refresh_token?: string;
}
```

1. `request.mfaEmailOtpLoginSessionToken` のハッシュ値で `mfa_email_otp_login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. セッションから `user_id` を取得してユーザー情報を検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
3. `mfa_email_otp_backup_codes` からユーザーのバックアップコードを検索
4. `request.code` をハッシュ化して `backup_code_hash` と照合
    - 一致するコードが存在しない場合は `401 Unauthorized` を返却
    - 既に使用済み（`used = true`）の場合は `401 Unauthorized` を返却
5. バックアップコードを使用済みとしてマーク:
    - `used` = `true`
    - `used_at` = 現在日時
6. アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
    - `sub` : `users.id`
7. セッションの `remember_me` が `true` の場合:
    - リフレッシュトークンを生成
    - `login_sessions` にレコードを作成（有効期限31日）
    - リフレッシュトークンをクッキーに設定
8. `mfa_email_otp_login_sessions` からレコードを削除
9. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/login/mfa/email-otp/complete`

```ts
interface Request {
  mfaEmailOtpLoginSessionToken: string;
  code: string;
}

interface Response {
  // なし
}

interface Cookie {
  access_token: string;
  refresh_token?: string;
}
```

1. `request.mfaEmailOtpLoginSessionToken` のハッシュ値で `mfa_email_otp_login_sessions` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. セッションから `user_id` を取得してユーザー情報を検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
3. `request.code` のバリデーション
    - 6桁の数字でない場合は `400 Bad Request` を返却
4. Email OTPコードを検証（`request.code` をハッシュ化してセッションの `otp_code_hash` と照合）
    - コードが不正な場合は `401 Unauthorized` を返却
5. アクセストークン（JWT、有効期限15分）を生成してクッキーに設定
    - `sub` : `users.id`
6. セッションの `remember_me` が `true` の場合:
    - リフレッシュトークンを生成
    - `login_sessions` にレコードを作成（有効期限31日）
    - リフレッシュトークンをクッキーに設定
7. `mfa_email_otp_login_sessions` からレコードを削除
8. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/logout`

```ts
interface Request {
  scope: "current" | "others" | "all";
}

interface Response {
  // なし
}
```

1. リフレッシュトークンをクッキーから取得
    - リフレッシュトークンが存在しない場合は `401 Unauthorized` を返却
2. `scope` に応じて `login_sessions` からレコードを削除:
    - `current` : 現在のリフレッシュトークンのみ削除
    - `others` : 現在のトークン以外のすべてのセッションを削除
    - `all` : ユーザーのすべてのセッションを削除
3. アクセストークンとリフレッシュトークンのクッキーを削除

[目次に戻る](#目次)

### `POST /api/v1/password-reset`

```ts
interface Request {
  email: string;
}

interface Response {
  // なし
}
```

1. メールアドレスのバリデーション
    - メールアドレスが不正な場合は `400 Bad Request` を返却
2. メールアドレスで `users` からユーザーを検索
    - ユーザーが存在しない場合でも成功レスポンスを返却（セキュリティ上、ユーザーの存在を漏らさない）
    - 有効期限内のパスワードリセットセッションがあれば `429 Too Many Requests` を返却
3. `password_reset_token` （ランダム文字列）を生成
4. `password_reset_sessions` にレコードを作成（有効期限: 1時間）
5. リセット用URL（ `/password-reset/complete?token={password_reset_token}` ）をメール送信
6. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/password-reset/complete`

```ts
interface Request {
  token: string;
  newPassword: string;
}

interface Response {
  // なし
}
```

1. `request.token` のハッシュ値で `password_reset_sessions.password_reset_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. 新しいパスワードのバリデーション
    - 要件を満たさない場合は `400 Bad Request` を返却
3. メールアドレスで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. 新しい `salt` を生成
5. 新しいパスワードをハッシュ化
6. `users` テーブルのパスワード関連フィールドを更新
    - `salt`
    - `password_hash`
7. `password_reset_sessions` からレコードを削除
8. セキュリティのため、該当ユーザーの全てのログインセッションを無効化
    - `login_sessions` から該当ユーザーのセッションを全て削除
9. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/password-change`

```ts
interface Request {
  currentPassword: string;
  newPassword: string;
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. 現在のパスワードをハッシュ化して照合
    - パスワードが一致しない場合は `401 Unauthorized` を返却
    - 認証失敗の試行回数をカウント（レート制限）
    - 試行回数が制限を超えた場合は `429 Too Many Requests` を返却
5. 新しいパスワードのバリデーション
    - 要件を満たさない場合は `400 Bad Request` を返却
    - 現在のパスワードと同じ場合は `400 Bad Request` を返却
6. 新しい `salt` を生成
7. 新しいパスワードをハッシュ化
8. `users` テーブルのパスワード関連フィールドを更新
    - `salt`
    - `password_hash`
9. セキュリティのため、現在のセッション以外の全てのログインセッションを無効化（オプション）
    - `login_sessions` から現在のリフレッシュトークン以外を削除
10. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/email-change`

```ts
interface Request {
  newEmail: string;
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. 新しいメールアドレスのバリデーション
    - メールアドレスが不正な場合は `400 Bad Request` を返却
4. 現在のメールアドレスと同じか確認
    - 同じ場合は `400 Bad Request` を返却
5. 新しいメールアドレスが他のユーザーで使用中か確認
    - 使用中の場合は `409 Conflict` を返却
6. 有効期限内のメール変更セッションがあるか確認
    - あれば `429 Too Many Requests` を返却
7. `email_change_token` （ランダム文字列）を生成
8. `email_change_sessions` にレコードを作成（有効期限: 24時間）
9. 確認URL（ `/email-change/complete?token={email_change_token}` ）を新しいメールアドレスへ送信
10. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/email-change/complete`

```ts
interface Request {
  token: string;
}

interface Response {
  // なし
}
```

1. `request.token` のハッシュ値で `email_change_sessions.email_change_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
2. 新しいメールアドレスが他のユーザーで使用中か再度確認
    - 使用中の場合は `409 Conflict` を返却
3. `users` テーブルの `email` を更新
4. `email_change_sessions` からレコードを削除
5. セキュリティのため、該当ユーザーの全てのログインセッションを無効化
    - `login_sessions` から該当ユーザーのセッションを全て削除
6. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/mfa/totp/enable`

```ts
interface Request {
  // なし
}

interface Response {
  mfaTotpEnableSessionToken: string;
  otpauthUri: string;
  totpSecret: string;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. 既にTOTP MFAが有効な場合は `400 Bad Request` を返却
5. 有効期限内のMFA有効化セッションがあるか確認
    - あれば `429 Too Many Requests` を返却
6. TOTPシークレットキーを生成（32文字のBase32エンコード文字列）
7. `mfa_totp_enable_session_token` （ランダム文字列）を生成
8. `mfa_totp_enable_sessions` にレコードを作成（有効期限: 15分）
9. URIを生成
    - 形式: `otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}`
    - 例: `otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp`
10. `200 OK` を返却

[目次に戻る](#目次)

### `POST /api/v1/mfa/totp/enable/complete`

```ts
interface Request {
  mfaTotpEnableSessionToken: string;
  code: string;
}

interface Response {
  backupCodes: Array<string>;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. `request.mfaTotpEnableSessionToken` のハッシュ値で `mfa_totp_enable_sessions.mfa_totp_enable_session_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
    - セッションの `user_id` が現在のユーザーIDと一致しない場合は `403 Forbidden` を返却
4. TOTPコードを検証（`request.code` とセッションの `totp_secret` を使用）
    - コードが不正な場合は `401 Unauthorized` を返却
5. バックアップコードを生成（10個のランダム文字列）
6. トランザクション開始
    - `users` テーブルを更新
        - `mfa_totp_enabled` = `true`
        - `mfa_totp_secret` = セッションの `totp_secret`
    - `mfa_totp_backup_codes` テーブルにバックアップコードを保存（ハッシュ化）
    - `mfa_totp_enable_sessions` からレコードを削除
    - コミット
7. `200 OK` を返却
    - `backupCodes`: バックアップコード一覧（平文）

[目次に戻る](#目次)

### `POST /api/v1/mfa/totp/disable`

```ts
interface Request {
  password: string;
  code: string;
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. TOTP MFAの有効状態を確認
    - `mfa_totp_enabled` が `false` なら `400 Bad Request` を返却
5. パスワードをハッシュ化して照合
    - パスワードが一致しない場合は `401 Unauthorized` を返却
6. TOTPコードを検証
    - コードが不正な場合は `401 Unauthorized` を返却
7. トランザクション開始
    - `users` テーブルを更新
        - `mfa_totp_enabled` = `false`
        - `mfa_totp_secret` = `NULL`
    - `mfa_totp_backup_codes` から該当ユーザーのコードを全て削除
    - コミット
8. `200 OK` を返却

[目次に戻る](#目次)

### `GET /api/v1/mfa/totp/backup-codes`

```ts
interface Request {
  // なし
}

interface Response {
  backupCodes: Array<{
    id: string;
    partialCode: string; // 一部マスク表示（例: "****-****-AB12"）
    used: boolean;
    usedAt?: string;
  }>;
  totalCount: number;
  unusedCount: number;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. TOTP MFAの有効状態を確認
    - `mfa_totp_enabled` が `false` なら `400 Bad Request` を返却
5. `mfa_totp_backup_codes` からユーザーのバックアップコードを全て取得
6. 各コードを整形:
    - `id` : バックアップコードID
    - `partialCode` : 最後の4文字のみ表示、残りは `*` でマスク
    - `used` : 使用済みフラグ
    - `usedAt` : 使用日時（使用済みの場合のみ）
7. `200 OK` を返却
    - `backupCodes` : コード一覧
    - `totalCount` : 総数
    - `unusedCount` : 未使用の数

[目次に戻る](#目次)

### `POST /api/v1/mfa/totp/backup-codes/regenerate`

```ts
interface Request {
  // なし
}

interface Response {
  backupCodes: Array<string>;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. TOTP MFAの有効状態を確認
    - `mfa_totp_enabled` が `false` なら `400 Bad Request` を返却
5. 新しいバックアップコードを生成（10個のランダム文字列）
6. トランザクション開始
    - `mfa_totp_backup_codes` から該当ユーザーの既存コードを全て削除
    - 新しいバックアップコードを `mfa_totp_backup_codes` に保存（ハッシュ化）
    - コミット
7. `200 OK` を返却
    - `backupCodes` : バックアップコード一覧（平文、この1回のみ表示）

[目次に戻る](#目次)

### `POST /api/v1/mfa/email-otp/enable`

```ts
interface Request {
  // なし
}

interface Response {
  mfaEmailOtpEnableSessionToken: string;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. 既にEmail OTP MFAが有効な場合は `400 Bad Request` を返却
5. 有効期限内のEmail OTP MFA有効化セッションがあるか確認
    - あれば `429 Too Many Requests` を返却
6. Email OTPコードを生成（6桁の数字）
7. `mfa_email_otp_enable_session_token` （ランダム文字列）を生成
8. `mfa_email_otp_enable_sessions` にレコードを作成（有効期限: 15分）
    - `otp_code_hash`: OTPコードのハッシュ値を保存
9. ユーザーのメールアドレスにOTPコードを送信
10. `200 OK` を返却
    - `mfaEmailOtpEnableSessionToken`: MFA Email OTP有効化セッショントークン

[目次に戻る](#目次)

### `POST /api/v1/mfa/email-otp/enable/complete`

```ts
interface Request {
  mfaEmailOtpEnableSessionToken: string;
  code: string;
}

interface Response {
  backupCodes: Array<string>;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. `request.mfaEmailOtpEnableSessionToken` のハッシュ値で `mfa_email_otp_enable_sessions.mfa_email_otp_enable_session_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
    - セッションの `user_id` が現在のユーザーIDと一致しない場合は `403 Forbidden` を返却
4. Email OTPコードを検証（`request.code` をハッシュ化してセッションの `otp_code_hash` と照合）
    - コードが不正な場合は `401 Unauthorized` を返却
5. バックアップコードを生成（10個のランダム文字列）
6. トランザクション開始
    - `users` テーブルを更新
        - `mfa_email_otp_enabled` = `true`
    - `mfa_email_otp_backup_codes` テーブルにバックアップコードを保存（ハッシュ化）
    - `mfa_email_otp_enable_sessions` からレコードを削除
    - コミット
7. `200 OK` を返却
    - `backupCodes`: バックアップコード一覧（平文）

[目次に戻る](#目次)

### `POST /api/v1/mfa/email-otp/disable`

```ts
interface Request {
  password: string;
}

interface Response {
  mfaEmailOtpDisableSessionToken: string;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. Email OTP MFAの有効状態を確認
    - `mfa_email_otp_enabled` が `false` なら `400 Bad Request` を返却
5. パスワードをハッシュ化して照合
    - パスワードが一致しない場合は `401 Unauthorized` を返却
6. 有効期限内のEmail OTP MFA無効化セッションがあるか確認
    - あれば `429 Too Many Requests` を返却
7. Email OTPコードを生成（6桁の数字）
8. `mfa_email_otp_disable_session_token` （ランダム文字列）を生成
9. `mfa_email_otp_disable_sessions` にレコードを作成（有効期限: 15分）
    - `otp_code_hash`: OTPコードのハッシュ値を保存
10. ユーザーのメールアドレスにOTPコードを送信
11. `200 OK` を返却
    - `mfaEmailOtpDisableSessionToken`: MFA Email OTP無効化セッショントークン

[目次に戻る](#目次)

### `POST /api/v1/mfa/email-otp/disable/complete`

```ts
interface Request {
  mfaEmailOtpDisableSessionToken: string;
  code: string;
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. `request.mfaEmailOtpDisableSessionToken` のハッシュ値で `mfa_email_otp_disable_sessions.mfa_email_otp_disable_session_token_hash` を検索
    - セッションが存在しない場合は `401 Unauthorized` を返却
    - セッションが有効期限切れの場合は `410 Gone` を返却
    - セッションの `user_id` が現在のユーザーIDと一致しない場合は `403 Forbidden` を返却
4. Email OTPコードを検証（`request.code` をハッシュ化してセッションの `otp_code_hash` と照合）
    - コードが不正な場合は `401 Unauthorized` を返却
5. トランザクション開始
    - `users` テーブルを更新
        - `mfa_email_otp_enabled` = `false`
    - `mfa_email_otp_backup_codes` から該当ユーザーのコードを全て削除
    - `mfa_email_otp_disable_sessions` からレコードを削除
    - コミット
6. `200 OK` を返却

[目次に戻る](#目次)

### `GET /api/v1/mfa/email-otp/backup-codes`

```ts
interface Request {
  // なし
}

interface Response {
  backupCodes: Array<{
    id: string;
    partialCode: string; // 一部マスク表示（例: "****-****-AB12"）
    used: boolean;
    usedAt?: string;
  }>;
  totalCount: number;
  unusedCount: number;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. Email OTP MFAの有効状態を確認
    - `mfa_email_otp_enabled` が `false` なら `400 Bad Request` を返却
5. `mfa_email_otp_backup_codes` からユーザーのバックアップコードを全て取得
6. 各コードを整形:
    - `id` : バックアップコードID
    - `partialCode` : 最後の4文字のみ表示、残りは `*` でマスク
    - `used` : 使用済みフラグ
    - `usedAt` : 使用日時（使用済みの場合のみ）
7. `200 OK` を返却
    - `backupCodes` : コード一覧
    - `totalCount` : 総数
    - `unusedCount` : 未使用の数

[目次に戻る](#目次)

### `POST /api/v1/mfa/email-otp/backup-codes/regenerate`

```ts
interface Request {
  // なし
}

interface Response {
  backupCodes: Array<string>;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. Email OTP MFAの有効状態を確認
    - `mfa_email_otp_enabled` が `false` なら `400 Bad Request` を返却
5. 新しいバックアップコードを生成（10個のランダム文字列）
6. トランザクション開始
    - `mfa_email_otp_backup_codes` から該当ユーザーの既存コードを全て削除
    - 新しいバックアップコードを `mfa_email_otp_backup_codes` に保存（ハッシュ化）
    - コミット
7. `200 OK` を返却
    - `backupCodes` : バックアップコード一覧（平文、この1回のみ表示）

[目次に戻る](#目次)

### `GET /api/v1/users/me`

```ts
interface Request {
  // なし
}

interface Response {
  id: string;
  email: string;
  createdAt: string;
  mfaTotpEnabled: boolean;
  mfaEmailOtpEnabled: boolean;
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. `200 OK` を返却

[目次に戻る](#目次)

### `GET /api/v1/sessions`

```ts
interface Request {
  // なし
}

interface Session {
  id: string;
  userAgent: string;
  createdAt: string;
  lastAccessedAt: string;
  isCurrent: boolean;
}

type Response = Array<{
  id: string;
  userAgent: string;
  createdAt: string;
  lastAccessedAt: string;
  isCurrent: boolean;
}>;
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. 現在のリフレッシュトークンをクッキーから取得
4. ユーザーIDで `login_sessions` から全セッションを検索
5. 各セッション情報を整形して返却
    - `id`: セッションID
    - `userAgent`: User-Agent文字列
    - `createdAt`: セッション作成日時
    - `lastAccessedAt`: 最終アクセス日時
    - `isCurrent`: 現在のセッションかどうか（リフレッシュトークンで判定）
6. `200 OK` を返却

[目次に戻る](#目次)

### `DELETE /api/v1/sessions/:sessionId`

```ts
interface Request {
  // なし
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. `:sessionId` で `login_sessions` からセッションを検索
    - セッションが存在しない場合は `404 Not Found` を返却
    - セッションの `user_id` が現在のユーザーIDと一致しない場合は `404 Not Found` を返却
4. `login_sessions` から該当セッションを削除
5. `200 OK` を返却

[目次に戻る](#目次)

### `DELETE /api/v1/users/me`

```ts
interface Request {
  // なし
}

interface Response {
  // なし
}
```

1. `loginRequired` を実施
2. `context.userId` を取得
3. ユーザーIDで `users` からユーザーを検索
    - ユーザーが存在しない場合は `404 Not Found` を返却
4. トランザクション開始
    - `deleted_users` にユーザー情報を退避
        - `user_id`: 元のユーザーID
        - `email`: メールアドレス
        - `deleted_at`: 削除日時
        - `reregistration_allowed_at`: 再登録可能日時（例: 削除日時 + 7日）
        - `expire_at`: 完全削除予定日（例: 削除日時 + 31日）
    - `login_sessions` からユーザーの全セッションを削除
    - `signup_sessions` からユーザーのメールアドレスに関連するセッションを削除（もしあれば）
    - `password_reset_sessions` からユーザーのメールアドレスに関連するセッションを削除（もしあれば）
    - `email_change_sessions` からユーザーのセッションを削除（もしあれば）
    - `mfa_totp_enable_sessions` からユーザーのセッションを削除（もしあれば）
    - `mfa_email_otp_enable_sessions` からユーザーのセッションを削除（もしあれば）
    - `mfa_totp_login_sessions` からユーザーのセッションを削除（もしあれば）
    - `mfa_email_otp_login_sessions` からユーザーのセッションを削除（もしあれば）
    - `mfa_totp_backup_codes` からユーザーのバックアップコードを全て削除（もしあれば）
    - `mfa_email_otp_backup_codes` からユーザーのバックアップコードを全て削除（もしあれば）
    - `users` テーブルからユーザーを削除
    - コミット
5. アクセストークンとリフレッシュトークンのクッキーを削除
6. `200 OK` を返却

[目次に戻る](#目次)

## DB

### `users`
- `id` : UUIDv7
- `email`
- `salt`
- `password_hash`
- `mfa_email_otp_enabled` : boolean
- `mfa_totp_enabled` : boolean
- `mfa_totp_secret` : string (nullable)
- `created_at`

### `deleted_users`
- `user_id` : UUIDv7 (元のユーザーID)
- `email`
- `deleted_at` : 削除日時
- `reregistration_allowed_at` : 再登録可能日時
- `expire_at` : 完全削除予定日時

### `signup_sessions`
- `id` : UUIDv7
- `email`
- `signup_session_token_hash`
- `created_at`
- `expire_at`

### `login_sessions`
- `id` : UUIDv7
- `user_id` -> `users.id`
- `refresh_token_hash`
- `user_agent`
- `created_at`
- `last_accessed_at`
- `expire_at`

### `password_reset_sessions`
- `email`
- `password_reset_token_hash`
- `created_at`
- `expire_at`

### `email_change_sessions`
- `user_id` -> `users.id`
- `new_email`
- `email_change_token_hash`
- `created_at`
- `expire_at`

### `mfa_totp_enable_sessions`
- `user_id` -> `users.id`
- `mfa_totp_enable_session_token_hash`
- `totp_secret`
- `created_at`
- `expire_at`

### `mfa_email_otp_enable_sessions`
- `user_id` -> `users.id`
- `mfa_email_otp_enable_session_token_hash`
- `otp_code_hash`
- `created_at`
- `expire_at`

### `mfa_totp_login_sessions`
- `user_id` -> `users.id`
- `mfa_totp_login_session_token_hash`
- `remember_me` : boolean
- `created_at`
- `expire_at`

### `mfa_email_otp_login_sessions`
- `user_id` -> `users.id`
- `mfa_email_otp_login_session_token_hash`
- `otp_code_hash`
- `remember_me` : boolean
- `created_at`
- `expire_at`

### `mfa_email_otp_disable_sessions`
- `user_id` -> `users.id`
- `mfa_email_otp_disable_session_token_hash`
- `otp_code_hash`
- `created_at`
- `expire_at`

### `mfa_totp_backup_codes`
- `id` : UUIDv7
- `user_id` -> `users.id`
- `backup_code_hash`
- `used` : boolean
- `created_at`
- `used_at` (nullable)

### `mfa_email_otp_backup_codes`
- `id` : UUIDv7
- `user_id` -> `users.id`
- `backup_code_hash`
- `used` : boolean
- `created_at`
- `used_at` (nullable)

[目次に戻る](#目次)
