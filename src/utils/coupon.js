const COUPON_ERRORS = Object.freeze({
  NOT_FOUND: 'COUPON_NOT_FOUND',
  EXPIRED: 'COUPON_EXPIRED',
  MIN_SUBTOTAL_NOT_MET: 'COUPON_MIN_SUBTOTAL_NOT_MET'
});

// Coupons only discount the product subtotal; shipping is never discounted
const COUPONS = Object.freeze({
  FLOWER100: Object.freeze({ type: 'fixed', amount: 100, minSubtotal: 800, active: true }),
  SPRING10: Object.freeze({ type: 'percent', percent: 10, maxDiscount: 300, minSubtotal: 0, active: true }),
  SUMMER50: Object.freeze({ type: 'fixed', amount: 50, minSubtotal: 0, active: false })
});

function normalizeCouponCode(couponCode) {
  return couponCode.trim().toUpperCase();
}

function calculateCouponDiscount(coupon, subtotal) {
  const discount = coupon.type === 'percent'
    ? Math.min(Math.round(subtotal * coupon.percent / 100), coupon.maxDiscount)
    : coupon.amount;
  return Math.min(discount, subtotal);
}

function rejectCoupon(error, message) {
  return Object.freeze({ ok: false, error, message });
}

/**
 * Apply a coupon code to an order subtotal.
 * Returns { ok: true, couponCode, discount } or { ok: false, error, message }.
 * A missing or blank code means no coupon: discount 0 and couponCode null.
 */
function applyCoupon({ subtotal, couponCode }) {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError('subtotal 必須為非負有限數');
  }

  if (couponCode !== undefined && couponCode !== null && typeof couponCode !== 'string') {
    throw new TypeError('couponCode 必須為字串');
  }

  if (!couponCode || couponCode.trim() === '') {
    return Object.freeze({ ok: true, couponCode: null, discount: 0 });
  }

  const code = normalizeCouponCode(couponCode);
  const coupon = Object.prototype.hasOwnProperty.call(COUPONS, code) ? COUPONS[code] : null;

  if (!coupon) {
    return rejectCoupon(COUPON_ERRORS.NOT_FOUND, '優惠碼不存在');
  }

  if (!coupon.active) {
    return rejectCoupon(COUPON_ERRORS.EXPIRED, '優惠碼已失效');
  }

  if (subtotal < coupon.minSubtotal) {
    return rejectCoupon(
      COUPON_ERRORS.MIN_SUBTOTAL_NOT_MET,
      `商品小計需滿 ${coupon.minSubtotal} 元才能使用此優惠碼`
    );
  }

  return Object.freeze({
    ok: true,
    couponCode: code,
    discount: calculateCouponDiscount(coupon, subtotal)
  });
}

module.exports = {
  COUPONS,
  COUPON_ERRORS,
  applyCoupon
};
