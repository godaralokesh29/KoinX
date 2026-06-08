const Joi = require('joi');
const Decimal = require('decimal.js');
const { DEFAULT_CONFIG } = require('../config/reconciliationConfig');

const validateTransaction = (row, source) => {
  const issues = [];
  const normalizedRow = { ...row };

  // Check required fields
  if (!row.type || row.type.trim() === '') {
    issues.push('Missing transaction type');
  }

  if (!row.asset || row.asset.trim() === '') {
    issues.push('Missing asset');
  }

  if (!row.quantity || row.quantity.trim() === '') {
    issues.push('Missing quantity');
  } else {
    const qtyNum = parseFloat(row.quantity);
    if (isNaN(qtyNum)) {
      issues.push(`Invalid quantity: ${row.quantity}`);
    } else if (qtyNum < 0) {
      issues.push('Quantity cannot be negative');
    }
  }

  if (!row.timestamp || row.timestamp.trim() === '') {
    issues.push('Missing timestamp');
  } else {
    const ts = new Date(row.timestamp);
    if (isNaN(ts.getTime())) {
      issues.push(`Invalid timestamp format: ${row.timestamp}`);
    }
  }

  // Validate transaction type
  if (row.type && !DEFAULT_CONFIG.VALID_TRANSACTION_TYPES.includes(row.type.toUpperCase())) {
    issues.push(`Invalid transaction type: ${row.type}`);
  }

  // Normalize asset to uppercase
  if (row.asset) {
    normalizedRow.asset = row.asset.toUpperCase().trim();
  }

  // Price validation (optional, but if present should be numeric)
  if (row.price && row.price.trim() !== '') {
    const priceNum = parseFloat(row.price);
    if (isNaN(priceNum) || priceNum < 0) {
      issues.push(`Invalid price: ${row.price}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    normalizedRow,
  };
};

module.exports = { validateTransaction };
