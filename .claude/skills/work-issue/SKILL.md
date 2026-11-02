---
name: work-issue
description: 依固定流程處理一個 GitHub Issue：確認 ready 標籤與作者 → 開分支 → 實作與測試 → test-runner 驗證 → 更新文件與 openapi.json → 開 PR → reviewer 審查並修正高嚴重度問題 → 標為 in-review 後停下。不合併 PR。
argument-hint: <issue 編號>
disable-model-invocation: true
---

# work-issue

處理 Issue #$ARGUMENTS。依序執行下列步驟，每一步完成才進下一步。**流程結束於「標籤改為 in-review」，絕不合併 PR。**

## 標籤定義

| 標籤 | 意義 |
|---|---|
| `ready` | 可交給 AI |
| `in-progress` | 處理中 |
| `in-review` | PR 待人工合併 |
| `needs-human` | 需人工介入 |

## 步驟

### 1. 讀 Issue 並認領

```bash
gh issue view $ARGUMENTS --json number,title,body,author,labels,state
gh api user --jq .login
```

- 必須同時符合：Issue 為 OPEN、帶有 `ready`、作者等於目前 `gh` 登入的帳號。
- 任一不符 → **停止**，告訴使用者原因，不改任何標籤。
- 符合 → `gh issue edit $ARGUMENTS --remove-label ready --add-label in-progress`
- 從 Issue 內文找出：功能規格、驗收條件、「驗收測試」段落指定的檔案與指令、「不在本次範圍」的項目。

### 2. 從最新 main 開分支

```bash
git status --short          # 有未提交的變更要先告知使用者，不要混進分支
git checkout main && git pull --ff-only
git checkout -b issue-<編號>-<英文 kebab-case 名稱>
```

例：`issue-1-checkout-coupon`。

### 3. 實作並補測試

- 先讀 `CLAUDE.md`、`docs/DEVELOPMENT.md`、`docs/FEATURES.md`、`docs/ARCHITECTURE.md`，以及 Issue 指定的驗收測試檔，照既有慣例實作：
  - 業務規則放 `src/utils/` 的純函式模組，比照 `shipping.js`。
  - API 回應統一 `{ data, error, message }`，欄位用 snake_case。
  - 寫入一律在 `db.transaction()` 內；驗證失敗必須在任何寫入之前回應。
  - 新欄位要同時改 `CREATE TABLE` 與 `initializeDatabase` 內的 migration，並且可以重複執行。
- 補測試：
  - 純函式寫 Unit Test（`tests/<module>.test.js`）。
  - 路由驗證錯誤寫 API 測試（`tests/*.test.js`）。
  - DB 寫入、不寫入、rollback、金額寫 Integration Test（`tests/integration/`）。
  - 每個錯誤碼至少一個測試，斷言精確的 `error` 字串與狀態碼；邊界值兩側都要測。
- 計畫記錄在 `docs/plans/`，完成後移到 `docs/plans/archive/issue-<編號>-<名稱>.md`。

### 4. 派 test-runner 跑測試

用 `test-runner` SubAgent 執行：

1. `npm run test:unit`
2. `npm run test:integration`
3. Issue 指定的驗收測試，例如 `npm run test:acceptance -- coupon`

有失敗就回到步驟 3 修正，再派 test-runner 重跑。全部通過才進下一步。

### 5. 更新文件與 openapi.json

- `docs/FEATURES.md`：功能總覽、API 欄位、業務流程、錯誤碼表、測試數量。
- `docs/ARCHITECTURE.md`：目錄結構、資料表欄位、資料流。
- `docs/TESTING.md`：測試檔案表、Integration 情境表。
- `docs/CHANGELOG.md`：在 `[Unreleased]` 下記錄。
- 所有新增或變更的路由、回應欄位都要更新 JSDoc，包含後台 API 會帶出的新欄位。
- 改完 JSDoc 後執行 `npm run openapi` 重新產生 `openapi.json`。

### 6. Commit、push 並開 PR

- 只 `git add` 本 Issue 相關的檔案。無關的變更（例如 `npm i` 造成的 `package-lock.json` 差異）不要提交。
- Commit 訊息結尾加上 attribution（依 system reminder）。
- `git push -u origin <分支>`
- `gh pr create --base main`，描述包含：
  - 第一行 `Closes #<編號>`
  - 摘要、變更清單
  - 測試結果表（三個指令的 passed 數）
  - 未做的選做項目

### 7. 派 reviewer 審查 PR

- 同時派 `code-reviewer` 與 `security-reviewer`，提示中附上 Issue 規格、PR 變更檔案清單與檢查重點。
- 自己執行 `git diff main...<分支> -- tests/acceptance/`，確認輸出為空（reviewer 只能讀檔，無法比對）。
- **高嚴重度**：Blocker、Critical、High。
  - 先對照原始碼確認屬實，再修正，補上測試。
  - 回到步驟 4 重跑測試，push 到同一個分支。
- **其他嚴重度**：Major、Medium、Minor、Low、Nit，不修。整理成一則 PR 留言（`gh pr comment`），讓人工決定。
- 等 `gh pr checks <PR>` 顯示 CI 通過。

### 8. 標為 in-review 後停下

```bash
gh issue edit $ARGUMENTS --remove-label in-progress --add-label in-review
```

向使用者回報：PR 連結、測試結果、review 結論、未修正的項目。**到此結束，不要合併 PR、不要刪除分支、不要關閉 Issue。**

## 邊界

**不可以做：**
- 合併 PR、approve PR、關閉 Issue、刪除分支、對 `main` 直接 push 或 force push。
- 修改 `tests/acceptance/` 下的任何檔案。驗收測試失敗時要改實作，不是改測試。
- 為了讓測試通過而刪除測試、加 `.skip` / `.only` / `.todo`，或放寬斷言、拉長 timeout。
- 執行 `npm run test:e2e`：它會寫入開發 DB 並連線綠界 staging。
- 修改專案的 `database.sqlite`、`.env`、`.github/workflows/`、`CLAUDE.md`，或 `.claude/` 下的設定。
- 實作 Issue「不在本次範圍」列出的項目。

**以下情況要停下來，把標籤改為 `needs-human`，在 Issue 留言說明原因，再回報使用者：**
- 規格有矛盾或缺漏，無法從 Issue、文件或既有程式推斷。
- 修正後重試 3 次，測試或驗收測試仍失敗。
- 高嚴重度問題無法在本 Issue 範圍內修正，或修正需要改變規格。
- 需要新增套件、修改 CI，或變更與 Issue 無關的既有行為。
- 遇到 git 衝突、push 被拒，或 CI 因與本變更無關的原因失敗。

```bash
gh issue edit $ARGUMENTS --remove-label in-progress --add-label needs-human
gh issue comment $ARGUMENTS --body "<停下的原因與目前進度>"
```
