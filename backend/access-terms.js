'use strict'

// Commercial terms explicitly confirmed by the owner on 27/10/2026.
const PRODUCT_ID = 'rv30'
const PROVIDER = 'asaas'
const PRICE_CENTS = 39900
const CURRENCY = 'BRL'
const ACCESS_DAYS = 365
const ACCESS_MILLISECONDS = ACCESS_DAYS * 24 * 60 * 60 * 1000

/** @param {unknown} approvedAt @returns {string|null} */
function accessExpiresAt(approvedAt) {
  if (typeof approvedAt !== 'string' || !approvedAt.trim()) return null
  const approved = Date.parse(approvedAt)
  if (!Number.isFinite(approved)) return null
  const expires = approved + ACCESS_MILLISECONDS
  if (!Number.isFinite(expires) || Math.abs(expires) > 8640000000000000) return null
  return new Date(expires).toISOString()
}

/** @typedef {{status?:string,expires_at?:string|null}} EntitlementTerms */
/** @param {EntitlementTerms|null|undefined} entitlement @param {number} [nowMs] */
function entitlementState(entitlement, nowMs = Date.now()) {
  if (!entitlement) return 'missing'
  if (entitlement.status === 'revoked') return 'revoked'
  if (entitlement.status === 'expired') return 'expired'
  if (entitlement.status !== 'active') return 'pending_review'
  const expires = typeof entitlement.expires_at === 'string' ? Date.parse(entitlement.expires_at) : NaN
  if (!Number.isFinite(expires) || !Number.isFinite(nowMs)) return 'pending_review'
  return expires > nowMs ? 'active' : 'expired'
}

/** @param {EntitlementTerms|null|undefined} entitlement @param {number} [nowMs] */
function isEntitlementActive(entitlement, nowMs = Date.now()) {
  return entitlementState(entitlement, nowMs) === 'active'
}

module.exports = { PRODUCT_ID, PROVIDER, PRICE_CENTS, CURRENCY, ACCESS_DAYS, ACCESS_MILLISECONDS, accessExpiresAt, entitlementState, isEntitlementActive }
