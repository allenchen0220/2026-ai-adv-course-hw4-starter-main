const { ORDER_LIST_PAGINATION, parseOrderListQuery } = require('../src/utils/orderListQuery');

describe('Order list query', () => {
  it('不帶參數時使用預設值：不篩選、第 1 頁、每頁 10 筆', () => {
    expect(parseOrderListQuery({})).toEqual({ ok: true, status: null, page: 1, limit: 10 });
    expect(parseOrderListQuery()).toEqual({ ok: true, status: null, page: 1, limit: 10 });
  });

  it.each(['pending', 'paid', 'failed'])('接受 status=%s', (status) => {
    expect(parseOrderListQuery({ status })).toMatchObject({ ok: true, status });
  });

  it('接受字串形式的正整數 page、limit', () => {
    expect(parseOrderListQuery({ page: '3', limit: '5' })).toEqual({ ok: true, status: null, page: 3, limit: 5 });
  });

  it.each([
    ['50', 50],
    ['51', ORDER_LIST_PAGINATION.MAX_LIMIT],
    ['100', ORDER_LIST_PAGINATION.MAX_LIMIT]
  ])('limit=%s 時以 %i 計', (limit, expected) => {
    expect(parseOrderListQuery({ limit }).limit).toBe(expected);
  });

  it.each([
    ['status 不在允許值內', { status: 'unknown' }],
    ['status 大小寫不符', { status: 'PAID' }],
    ['status 為空字串', { status: '' }],
    ['status 重複帶入', { status: ['paid', 'pending'] }],
    ['page 為 0', { page: '0' }],
    ['page 為負數', { page: '-1' }],
    ['page 為小數', { page: '1.5' }],
    ['page 不是數字', { page: 'abc' }],
    ['page 為空字串', { page: '' }],
    ['page 超過安全整數範圍', { page: '9007199254740993' }],
    ['page 遠超過資料庫整數範圍', { page: '99999999999999999999999' }],
    ['limit 為 0', { limit: '0' }],
    ['limit 為負數', { limit: '-1' }],
    ['limit 重複帶入', { limit: ['5', '10'] }],
    ['limit 超過安全整數範圍', { limit: '99999999999999999999999' }]
  ])('%s時回傳錯誤', (_label, query) => {
    const result = parseOrderListQuery(query);

    expect(result.ok).toBe(false);
    expect(typeof result.message).toBe('string');
  });
});
