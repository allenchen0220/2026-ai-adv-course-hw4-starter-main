const { COUPON_ERRORS, applyCoupon } = require('../src/utils/coupon');

describe('Coupon module', () => {
  describe('未使用優惠碼', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['空字串', ''],
      ['空白字串', '   ']
    ])('%s 視為未使用，折扣為 0', (_label, couponCode) => {
      const result = applyCoupon({ subtotal: 1000, couponCode });

      expect(result).toEqual({ ok: true, couponCode: null, discount: 0 });
    });
  });

  describe('FLOWER100', () => {
    it.each([
      [800, 100],
      [1550, 100],
      [1600, 100]
    ])('商品小計 %i 元折抵 %i 元', (subtotal, discount) => {
      const result = applyCoupon({ subtotal, couponCode: 'FLOWER100' });

      expect(result).toEqual({ ok: true, couponCode: 'FLOWER100', discount });
    });

    it('商品小計 799 元未達門檻', () => {
      const result = applyCoupon({ subtotal: 799, couponCode: 'FLOWER100' });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(COUPON_ERRORS.MIN_SUBTOTAL_NOT_MET);
    });
  });

  describe('SPRING10', () => {
    it.each([
      [1000, 100],
      [1234, 123],
      [1235, 124],
      [3000, 300],
      [3500, 300],
      [5, 1]
    ])('商品小計 %i 元折抵 %i 元', (subtotal, discount) => {
      const result = applyCoupon({ subtotal, couponCode: 'SPRING10' });

      expect(result).toEqual({ ok: true, couponCode: 'SPRING10', discount });
    });
  });

  describe('無法使用的優惠碼', () => {
    it.each([
      ['已失效', 'SUMMER50', COUPON_ERRORS.EXPIRED],
      ['不存在', 'NOT-A-COUPON', COUPON_ERRORS.NOT_FOUND],
      ['原型鏈屬性名稱', 'constructor', COUPON_ERRORS.NOT_FOUND]
    ])('%s：%s', (_label, couponCode, error) => {
      const result = applyCoupon({ subtotal: 1000, couponCode });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
      expect(typeof result.message).toBe('string');
    });
  });

  it('不分大小寫並去除前後空白，以大寫記錄', () => {
    const result = applyCoupon({ subtotal: 800, couponCode: '  flower100 ' });

    expect(result).toEqual({ ok: true, couponCode: 'FLOWER100', discount: 100 });
  });

  it.each([
    ['subtotal 為負數', { subtotal: -1, couponCode: 'SPRING10' }],
    ['subtotal 不是數字', { subtotal: '1000', couponCode: 'SPRING10' }],
    ['couponCode 不是字串', { subtotal: 1000, couponCode: 100 }]
  ])('%s時拋出 TypeError', (_label, input) => {
    expect(() => applyCoupon(input)).toThrow(TypeError);
  });
});
