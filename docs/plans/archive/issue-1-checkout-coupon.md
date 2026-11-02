# Issue #1：結帳優惠碼

- 分支：`issue-1-checkout-coupon`
- 驗收測試：`npm run test:acceptance -- coupon`（`tests/acceptance/coupon.test.js`，不得修改）

## 做法

1. 新增 `src/utils/coupon.js`：比照 Shipping 模組，為純函式模組。三組優惠碼寫在模組中，`applyCoupon({ subtotal, couponCode })` 回傳折扣或錯誤碼。
2. `orders` 新增 `coupon_code`、`discount` 欄位，並在 `initializeDatabase` 補上 migration；舊訂單為 `NULL` 與 0。
3. `POST /api/orders`：
   - 驗證 `couponCode` 為選填字串。
   - 算出小計後先套用優惠碼，失敗就回 400，此時尚未寫入任何資料。
   - 以 `subtotal - discount` 呼叫 `calculateShipping`，讓免運門檻依折扣後小計判斷，`totalAmount` 也自然等於 `subtotal - discount + shippingFee`。
4. 建單、列表、詳情的回應都加上 `discount`、`coupon_code`；綠界表單沿用 `total_amount`，不需修改。
5. 前台訂單詳情與後台訂單詳情顯示優惠折抵；結帳頁輸入欄位為選做，本次不做。

## 測試

- `tests/coupon.test.js`：三組優惠碼、門檻邊界、四捨五入與上限、大小寫與空白、無效輸入。
- Integration：優惠碼快照寫入 DB、綠界 `TotalAmount` 為折扣後總額；優惠碼被拒時訂單、庫存與購物車不變。

## 狀態

已完成，PR 待人工合併。
