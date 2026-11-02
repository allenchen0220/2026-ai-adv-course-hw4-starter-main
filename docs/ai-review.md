# AI Review：訂單、付款、運費、購物車

- 日期：2026-11-02
- 範圍：訂單、付款（綠界）、運費、購物車，以及相關測試
- 方式：
  - `security-reviewer`：權限、身分驗證、金流、輸入驗證
  - `code-reviewer`：業務邏輯、規格、測試完整性
  - `test-runner`：`test:unit`、`test:integration`
- 狀態：已修正 #1、#2、#3、#4、#5、#6、#7、#12，以及 #9、#17 的部分測試；其餘待處理（見文末「修正紀錄」）

「已驗證」表示主 session 有對照原始碼確認；「未驗證」表示目前只有 reviewer 的推論。

## 測試執行結果

| 指令 | 結果 |
|---|---|
| `npm run test:unit` | 54 passed / 0 failed / **1 skipped** |
| `npm run test:integration` | 10 passed / 0 failed / 0 skipped |

被跳過的是 `tests/shipping.test.js:29`「商品小計 1,500 元時免基本運費」，這個 skip 正好掩蓋了 #2 的 bug。測試全綠不代表沒有問題。

## 問題總覽

| # | 嚴重度 | 問題 | 位置 | 來源 | 狀態 |
|---|---|---|---|---|---|
| 1 | High | 訂單詳情沒有檢查擁有者（IDOR） | `src/routes/orderRoutes.js:350-351` | 兩者 | 已驗證 |
| 2 | High | 免運門檻用 `>`，邊界測試被 skip | `src/utils/shipping.js:40`、`tests/shipping.test.js:29` | code / test-runner | 已驗證 |
| 3 | High | 購物車 PATCH 數量未驗證正整數 | `src/routes/cartRoutes.js:296-299` | 兩者 | 已驗證 |
| 4 | Medium | 前端免運判斷 `>=` 與後端不一致 | `public/js/pages/checkout.js:28` | code | 已驗證 |
| 5 | Medium | 付款查詢缺少 CheckMacValue 時略過驗簽 | `src/services/paymentService.js:15` | 兩者 | 已驗證 |
| 6 | Medium | 綠界金鑰、管理員密碼有寫死的預設值 | `src/utils/ecpay.js:4-6`、`src/database.js:116-117` | security | 已驗證 |
| 7 | Medium | 管理員角色只看 JWT，不對照 DB | `src/middleware/authMiddleware.js:18,27-31` | security | 已驗證 |
| 8 | Medium | 綠界付款表單頁沒有身分驗證 | `src/routes/pageRoutes.js:61-72` | security | 已驗證 |
| 9 | Medium | 購物車與訂單的失敗路徑測試不足 | `tests/cart.test.js`、`tests/orders.test.js` | 兩者 | 未逐項驗證 |
| 10 | Low | `X-Session-Id` 沒有格式驗證 | `src/middleware/sessionMiddleware.js:2-4` | 兩者 | 已驗證 |
| 11 | Low | 扣庫存沒有原子條件，檢查在 transaction 外 | `src/services/orderService.js:83`、`src/routes/orderRoutes.js:167` | code | 未驗證 |
| 12 | Low | 頁面渲染錯誤直接回傳 `err.message` | `src/routes/pageRoutes.js:9,17` | security | 已驗證 |
| 13 | Low | 模擬付款端點只靠 `NODE_ENV=test` 保護 | `src/routes/orderRoutes.js:25-30` | security | 已驗證 |
| 14 | Low | 偏遠地區附加費由前端自行申報 | `src/routes/orderRoutes.js:149,181-186` | security | 待確認規格 |
| 15 | Low | 收件欄位沒有長度上限 | `src/utils/validators.js:3-5` | security | 未驗證 |
| 16 | Low | 登入回應時間可推測帳號是否存在，且沒有 rate limit | `src/routes/authRoutes.js:228-234` | security | 未驗證 |
| 17 | Minor | 測試斷言太寬或依賴種子資料 | `tests/orders.test.js:15-17,48,78-80`、`tests/adminOrders.test.js:57-59` | code | 部分驗證 |
| 18 | Nit | OpenAPI JSDoc 漏列狀態碼；transaction 內步驟順序與文件描述不同 | 見下方 | code | 未驗證 |

## 詳細說明

### 1. 訂單詳情沒有檢查擁有者（IDOR）

`GET /api/orders/:id` 呼叫 `findOrderById(req.params.id)`，只用訂單 id 查詢。同一個檔案裡的 `/pay`（:446）和 `/check-payment`（:499）都正確使用了 `findOrderForUser`。

- **情境**：會員 B 用自己的 JWT 查詢會員 A 的訂單 id，會得到 200，內容包含 A 的收件人姓名、Email、地址與品項。訂單 id 會出現在 `/orders/:id`、綠界 `ClientBackURL`、`/ecpay/payment/:orderId` 等網址中，有外流的機會。
- **規格**：`docs/FEATURES.md` 規定查詢條件要包含 `user_id`，他人訂單視為 404。
- **建議**：改用 `findOrderForUser(req.params.id, req.user.userId)`，並補一個「用他人 token 查詢回 404」的測試。

### 2. 免運門檻用 `>`，邊界測試被 skip

`qualifiesForFreeShipping` 寫成 `subtotal > 1500`，但規格是「滿 1,500 免基本運費」。唯一驗證這個邊界的測試被改成 `it.skip`。

- **情境**：小計剛好 1,500 元、選宅配時，後端收 120 元運費，總額變成 1,620 元。
- **建議**：改成 `>=`，拿掉 `.skip`，並補上超商取貨在 1,500 元的情境。

### 3. 購物車 PATCH 數量未驗證正整數

POST 有用 `parsePositiveInteger`，PATCH 卻只用 `Number(quantity)` 搭配 `isNaN` 檢查。

- **小數**：`quantity: 0.5` 可以存入。SQLite 會把它存成 REAL，結帳時算出 `price × 0.5`，造成少付款，`stock - 0.5` 也會讓庫存變成小數。
- **0、負數、`""`、`null`**：會觸發 DB 的 CHECK constraint，回 500，而不是 400 `VALIDATION_ERROR`。
- **`true`、`"1e1"`**：分別被當成 1 和 10 接受。
- **建議**：改用 `parsePositiveInteger`。建立訂單時也再驗證一次數量（縱深防禦），並補測試。

### 4. 前端免運判斷與後端不一致

`checkout.js` 用 `cartTotal >= 1500` 判斷免運，費率也是寫死在前端。小計 1,500 元時，結帳頁顯示運費 0，實際扣款卻是 1,620 元。修好 #2 就會一致。長期建議由後端提供試算結果，避免同一套規則維護兩份。

### 5. 付款查詢缺少 CheckMacValue 時略過驗簽

條件寫成 `if (tradeInfo.CheckMacValue && !verifyCheckMacValue(...))`。只要回應不帶 CheckMacValue，就只剩 MerchantTradeNo 和 TradeAmt 兩項比對，訂單仍會被標成 paid。

- **規格**：`docs/FEATURES.md` 要求先驗證 CheckMacValue。
- **建議**：一律驗證，缺少時視為失敗，並補一個「付款成功但沒有 CheckMacValue」的整合測試。

### 6. 綠界金鑰、管理員密碼有寫死的預設值

- **綠界金鑰**：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV` 沒設定時會退回綠界公開的測試值，`ECPAY_ENV=production` 時也一樣。
- **管理員帳密**：預設為 `admin@hexschool.com` / `12345678`。
- **建議**：正式環境缺少這些設定時讓啟動失敗，做法同 `server.js` 對 `JWT_SECRET` 的檢查。

### 7. 管理員角色只看 JWT

`authMiddleware` 查 DB 時只取 `id`，`role` 用的是 JWT 內的值。Token 有效期 7 天，所以管理員被降權後，舊 token 仍能存取 `/api/admin/*`。

- **建議**：改成 `SELECT id, role`，並以 DB 的 role 為準。

### 8. 綠界付款表單頁沒有身分驗證

`GET /ecpay/payment/:orderId` 只要有訂單 id，任何人都能取得已簽章的付款表單，裡面有品項與金額。

- **建議**：改由需要 JWT 的 API 驗證擁有者後再回傳表單，或改用短效的付款 token。

### 9. 失敗路徑測試不足

規格裡的下列錯誤情境目前沒有測試：

- **購物車**：
  - 加入時超過庫存，或累加後超過庫存
  - PATCH 數量為 0、負數、小數，或超過庫存
  - 修改或刪除他人的購物車品項
  - 完全沒有認證、JWT 無效但有帶 session
- **訂單**：
  - Email 或 `shippingMethod` 不合法
  - 他人訂單應回 404
  - `check-payment` 的 `NO_TRADE_NO`
  - 已付款訂單的處理
- **安全**：
  - Token 偽造、過期、`alg=none`
  - 管理員端點未帶 token 應回 401
  - `/ecpay/payment/:orderId` 未授權存取
  - 前端竄改金額應被忽略

### 10. `X-Session-Id` 沒有格式驗證

伺服器接受任何字串作為 session id，包括 `"1"` 這類可猜的值。登入時又會把這個 session 的訪客購物車合併到帳號，所以知道別人的 session id 就能把對方的購物車搬走。

- **建議**：驗證 UUID 格式，不符合就忽略。

### 11. 扣庫存沒有原子條件

`UPDATE products SET stock = stock - ?` 沒有加 `AND stock >= ?`，庫存檢查也在 transaction 外。目前是單一 process 加上同步 API，實際上不會交錯執行。但如果之後改成多個 process，超賣時會回 500 而不是 400 `STOCK_INSUFFICIENT`。

### 12～16. 其他 Low

- **#12 頁面渲染錯誤**：`renderFront` 和 `renderAdmin` 用 `res.status(500).send(err.message)`，繞過了 `errorHandler`，可能洩漏伺服器路徑。建議改成 `next(err)`。
- **#13 模擬付款端點**：`PATCH /api/orders/:id/pay` 只靠 `NODE_ENV=test` 保護。部署時如果誤設，任何會員都能把自己的訂單標成已付款。
- **#14 偏遠地區附加費**：`isRemoteArea` 完全由前端送出，沒有對照地址。需要確認規格是否允許使用者自行申報。
- **#15 收件欄位長度**：姓名、Email、地址都沒有長度上限。
- **#16 帳號列舉**：帳號不存在時登入會略過 bcrypt，回應比較快；註冊回 409；全專案沒有 rate limit。

### 17. 測試品質（Minor）

- **`tests/orders.test.js:78-80`**：空購物車測試只斷言有 `error` 欄位，沒有斷言值是 `CART_EMPTY`。
- **`tests/orders.test.js:15-17,48`**：取 `products[0]`，依賴種子資料的順序；預期運費用測試內自己寫的公式算，所以永遠不會碰到 1,500 元的邊界。
- **`tests/adminOrders.test.js:57-59`**：狀態篩選用迴圈逐筆斷言，回傳 0 筆時測試也會通過。

### 18. Nit

- **OpenAPI JSDoc 漏列狀態碼**：`src/routes/orderRoutes.js:110-111` 的 POST 沒列 401；`:486-494` 的 check-payment 回應沒有 schema；`src/routes/adminOrderRoutes.js:35` 沒列 401/403。
- **transaction 步驟順序**：`src/services/orderService.js:103-106` 是每個品項先寫快照再扣庫存，與 CLAUDE.md 描述的「寫入品項快照 → 扣庫存」順序不同。原子性沒有問題，回滾也有整合測試驗證。

## 已確認沒有問題

- **權限**：管理員路由都掛上了 `authMiddleware` 和 `adminMiddleware`。
- **JWT**：指定 `HS256`；`JWT_SECRET` 沒設定時啟動會失敗；Token 無效時直接回 401，不會 fallback 到 session。
- **建立訂單**：只接受 JWT；金額由伺服器依 DB 價格計算；整個流程在 transaction 內，回滾有整合測試。
- **購物車**：所有查詢都帶 `user_id` 或 `session_id` 條件，SQL 全部使用參數綁定。
- **綠界驗簽**：CheckMacValue 用 `timingSafeEqual` 比對；`markOrderPaid` 以 `WHERE status='pending'` 防止重複處理。
- **XSS**：EJS 頁面只用 `<%= %>` 輸出變數；前端用 `textContent` 和 Vue 的轉義輸出，沒有發現 XSS。
- **測試設定**：
  - 只有 `tests/shipping.test.js:29` 一個 `skip`，沒有 `.only`、`.todo`。
  - Vitest 使用 `:memory:` DB。
  - Playwright 沒有設定 `webServer`。
- **驗收測試**：`tests/acceptance/` 是尚未實作的 Issue，目前預期會失敗，依 `docs/TESTING.md` 不得修改。

## 建議修正順序

1. **#1 IDOR、#3 PATCH 數量**：資料外洩與少付款。
2. **#2 加 #4 免運門檻**：拿掉 skip，前後端統一用 `>=`。
3. **#5 強制驗簽**、**#6 正式環境的金鑰檢查**。
4. **補 #9 的失敗路徑測試**，並收緊 #17 的斷言。
5. **其餘 Medium、Low 依需要排入**。

## 修正紀錄（2026-11-02）

| # | 處理 | 修改 |
|---|---|---|
| 1 | 已修正 | `GET /api/orders/:id` 改用 `findOrderForUser`；新增「他人訂單回 404」測試 |
| 2 | 已修正 | 免運門檻改為 `>=`；移除 `it.skip`，宅配與超商都驗證 1,500 元邊界 |
| 3 | 已修正 | PATCH 改用 `parsePositiveInteger`；新增 0、負數、小數、`"1e1"`、`true`、`null`、`""` 回 400 的測試 |
| 4 | 已修正 | 後端改為 `>=` 後與 `checkout.js` 一致，前端不需修改 |
| 5 | 已修正 | 一律驗證 CheckMacValue；整合測試新增「付款成功但沒有 CheckMacValue」 |
| 6 | 已修正 | `server.js`：`ECPAY_ENV=production` 缺綠界金鑰，或 `NODE_ENV=production` 缺 `ADMIN_PASSWORD` 時啟動失敗 |
| 7 | 已修正 | `authMiddleware` 改用 DB 的 role；新增「token 帶 admin、DB 為 user 回 403」測試 |
| 12 | 已修正 | 頁面渲染錯誤只在伺服器記錄 log，回應固定的「伺服器錯誤」 |
| 9、17 | 部分修正 | 空購物車斷言改為 `CART_EMPTY`；後台狀態篩選先斷言有資料；其餘失敗路徑測試待補 |
| 8 | 待處理 | 需調整付款流程（改由 JWT API 取得表單），會動到前端 |
| 10 | 待處理 | 驗證 UUID 格式需要同步修改既有測試的 session id |
| 11、13～16、18 | 待處理 | Low / Nit，或需要先確認規格 |

修正後的測試結果：`test:unit` 59 passed、0 skipped；`test:integration` 10 passed。
