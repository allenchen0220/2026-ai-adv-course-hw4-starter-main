const { parsePositiveInteger } = require('./validators');

const ORDER_STATUSES = Object.freeze(['pending', 'paid', 'failed']);

const ORDER_LIST_PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50
});

function invalidQuery(message) {
  return Object.freeze({ ok: false, message });
}

// Digit strings beyond Number.MAX_SAFE_INTEGER lose precision and overflow SQLite's OFFSET
function parseSafePositiveInteger(value) {
  const parsed = parsePositiveInteger(value);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parse the member order list query (status, page, limit).
 * Returns { ok: true, status, page, limit } or { ok: false, message }.
 * Missing values fall back to defaults; limit above the maximum is capped.
 */
function parseOrderListQuery({ status, page, limit } = {}) {
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return invalidQuery(`status 必須為 ${ORDER_STATUSES.join('、')}`);
  }

  const parsedPage = page === undefined ? ORDER_LIST_PAGINATION.DEFAULT_PAGE : parseSafePositiveInteger(page);
  if (parsedPage === null) {
    return invalidQuery('page 必須為正整數');
  }

  const parsedLimit = limit === undefined ? ORDER_LIST_PAGINATION.DEFAULT_LIMIT : parseSafePositiveInteger(limit);
  if (parsedLimit === null) {
    return invalidQuery('limit 必須為正整數');
  }

  return Object.freeze({
    ok: true,
    status: status === undefined ? null : status,
    page: parsedPage,
    limit: Math.min(parsedLimit, ORDER_LIST_PAGINATION.MAX_LIMIT)
  });
}

module.exports = {
  ORDER_STATUSES,
  ORDER_LIST_PAGINATION,
  parseOrderListQuery
};
