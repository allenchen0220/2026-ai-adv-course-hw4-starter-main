# Issue #5：我的訂單篩選與分頁

- 分支：`issue-5-order-filter-pagination`
- 驗收測試：`npm run test:acceptance -- order-filter`（`tests/acceptance/order-filter.test.js`，不得修改）

## 做法

1. 新增 `src/utils/orderListQuery.js`：純函式 `parseOrderListQuery` 驗證 `status` 白名單與 `page`、`limit` 正整數（沿用 `parsePositiveInteger`），套用預設值（1、10）與 `limit` 上限 50。
2. `listOrdersForUser(userId, { status, page, limit })` 改為回傳 `{ orders, total }`，以 `user_id`（與選填 `status`）查詢，`ORDER BY created_at DESC, rowid DESC` 讓同一秒建立的訂單也是新的在前。
3. `GET /api/orders` 驗證失敗回 400 `VALIDATION_ERROR`；成功時回傳 `pagination: { page, limit, total, totalPages }`，格式與 `GET /api/admin/orders` 相同。
4. 前台「我的訂單」頁讀取新格式，加上上一頁／下一頁，避免超過 10 筆的訂單看不到。狀態篩選 UI 為選做，本次不做。

## 測試

- `tests/orderListQuery.test.js`：預設值、狀態白名單、limit 上限、各種非法值。
- `tests/orders.test.js`：列表回傳 `pagination`、狀態篩選、limit 上限、超過最後一頁、非法參數回 400。

## 狀態

已完成，PR 待人工合併。
