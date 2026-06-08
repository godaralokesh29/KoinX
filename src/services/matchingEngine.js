const Decimal = require('decimal.js');
const { getConfig } = require('../config/reconciliationConfig');

class MatchingEngine {
  constructor() {
    this.config = getConfig();
  }

  async matchTransactions(userTxns, exchangeTxns, configOverrides = {}) {
    this.config = getConfig(configOverrides);

    const matched = [];
    const conflicting = [];
    const unmatchedUser = [];
    const unmatchedExchange = [];

    const usedExchangeIndices = new Set();

    // Try to match each user transaction
    for (let i = 0; i < userTxns.length; i++) {
      const userTxn = userTxns[i];
      let foundMatch = false;

      for (let j = 0; j < exchangeTxns.length; j++) {
        if (usedExchangeIndices.has(j)) continue;

        const exchangeTxn = exchangeTxns[j];
        const matchResult = this._evaluateMatch(userTxn, exchangeTxn);

        if (matchResult.isMatch) {
          usedExchangeIndices.add(j);

          if (matchResult.isExact) {
            matched.push({
              userTransaction: this._serializeTxn(userTxn),
              exchangeTransaction: this._serializeTxn(exchangeTxn),
              matchReason: matchResult.reason,
              category: 'MATCHED',
            });
          } else {
            conflicting.push({
              userTransaction: this._serializeTxn(userTxn),
              exchangeTransaction: this._serializeTxn(exchangeTxn),
              discrepancies: matchResult.discrepancies,
              matchReason: matchResult.reason,
              category: 'CONFLICTING',
            });
          }

          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        unmatchedUser.push({
          transaction: this._serializeTxn(userTxn),
          source: 'user',
          reason: 'No matching exchange transaction found',
          category: 'UNMATCHED_USER',
        });
      }
    }

    // Remaining exchange transactions are unmatched
    for (let j = 0; j < exchangeTxns.length; j++) {
      if (!usedExchangeIndices.has(j)) {
        const exchangeTxn = exchangeTxns[j];
        unmatchedExchange.push({
          transaction: this._serializeTxn(exchangeTxn),
          source: 'exchange',
          reason: 'No matching user transaction found',
          category: 'UNMATCHED_EXCHANGE',
        });
      }
    }

    return {
      matched,
      conflicting,
      unmatchedUser,
      unmatchedExchange,
    };
  }

  _evaluateMatch(userTxn, exchangeTxn) {
    // 1. Check if assets match (with alias resolution)
    const assetsMatch = this._normalizeAsset(userTxn.asset) === this._normalizeAsset(exchangeTxn.asset);
    if (!assetsMatch) {
      return { isMatch: false };
    }

    // 2. Check if types match or can be mapped
    const typesMatch = this._typesMatch(userTxn.type, exchangeTxn.type);
    if (!typesMatch) {
      return { isMatch: false };
    }

    // 3. Check timestamp tolerance
    const timestampMatch = this._checkTimestampTolerance(userTxn.timestamp, exchangeTxn.timestamp);
    if (!timestampMatch) {
      return { isMatch: false };
    }

    // 4. Check quantity tolerance
    const quantityMatch = this._checkQuantityTolerance(userTxn.quantity, exchangeTxn.quantity);
    if (!quantityMatch) {
      return { isMatch: false };
    }

    // Collect discrepancies (for conflicting classification)
    const discrepancies = [];
    if (!this._exactTimestampMatch(userTxn.timestamp, exchangeTxn.timestamp)) {
      discrepancies.push(`Timestamp differs: user=${userTxn.timestamp}, exchange=${exchangeTxn.timestamp}`);
    }

    if (!this._exactQuantityMatch(userTxn.quantity, exchangeTxn.quantity)) {
      discrepancies.push(`Quantity differs: user=${userTxn.quantity}, exchange=${exchangeTxn.quantity}`);
    }

    const isExact = discrepancies.length === 0;
    const reason = isExact
      ? `Exact match on asset=${userTxn.asset}, type=${userTxn.type}, quantity, and timestamp`
      : `Match within tolerance: asset=${userTxn.asset}, type=${userTxn.type}`;

    return {
      isMatch: true,
      isExact,
      discrepancies,
      reason,
    };
  }

  _normalizeAsset(asset) {
    const upper = asset.toUpperCase();

    // Check if it's an alias
    for (const [canonical, aliases] of Object.entries(this.config.ASSET_ALIASES)) {
      if (upper === canonical || aliases.map((a) => a.toUpperCase()).includes(upper)) {
        return canonical;
      }
    }

    return upper;
  }

  _typesMatch(userType, exchangeType) {
    const uType = userType.toUpperCase();
    const eType = exchangeType.toUpperCase();

    if (uType === eType) return true;

    // Check for mapped opposites (TRANSFER_IN <-> TRANSFER_OUT)
    if (this.config.TRANSACTION_TYPE_MAPPINGS[uType]) {
      return this.config.TRANSACTION_TYPE_MAPPINGS[uType].includes(eType);
    }

    if (this.config.TRANSACTION_TYPE_MAPPINGS[eType]) {
      return this.config.TRANSACTION_TYPE_MAPPINGS[eType].includes(uType);
    }

    return false;
  }

  _checkTimestampTolerance(userTs, exchangeTs) {
    const diff = Math.abs(userTs.getTime() - exchangeTs.getTime()) / 1000; // Convert to seconds
    return diff <= this.config.TIMESTAMP_TOLERANCE_SECONDS;
  }

  _exactTimestampMatch(userTs, exchangeTs) {
    return userTs.getTime() === exchangeTs.getTime();
  }

  _checkQuantityTolerance(userQty, exchangeQty) {
    const uQty = new Decimal(this._toDecimalString(userQty));
    const eQty = new Decimal(this._toDecimalString(exchangeQty));

    if (uQty.isZero() && eQty.isZero()) return true;

    const tolerance = uQty.mul(this.config.QUANTITY_TOLERANCE_PCT / 100);
    const diff = uQty.minus(eQty).abs();

    return diff.lessThanOrEqualTo(tolerance);
  }

  _exactQuantityMatch(userQty, exchangeQty) {
    const uQty = new Decimal(this._toDecimalString(userQty));
    const eQty = new Decimal(this._toDecimalString(exchangeQty));
    return uQty.equals(eQty);
  }

  _toDecimalString(value) {
    if (value == null) return '0';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object' && value.toString) return value.toString();
    return String(value);
  }

  _serializeTxn(txn) {
    return {
      transactionId: txn.transactionId,
      type: txn.type,
      asset: txn.asset,
      quantity: this._toDecimalString(txn.quantity),
      price: txn.price ? this._toDecimalString(txn.price) : null,
      timestamp: txn.timestamp.toISOString(),
      dataQualityFlags: txn.dataQualityFlags || [],
    };
  }
}

module.exports = new MatchingEngine();
