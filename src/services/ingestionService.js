const fs = require('fs');
const csv = require('csv-parser');
const UserTransaction = require('../models/UserTransaction');
const ExchangeTransaction = require('../models/ExchangeTransaction');
const DataQualityIssue = require('../models/DataQualityIssue');
const { validateTransaction } = require('../validators/transactionValidator');
const Decimal = require('decimal.js');

class IngestionService {
  async ingestUserTransactions(filePath) {
    return this._ingestTransactions(filePath, 'user', UserTransaction);
  }

  async ingestExchangeTransactions(filePath) {
    return this._ingestTransactions(filePath, 'exchange', ExchangeTransaction);
  }

  async _ingestTransactions(filePath, source, Model) {
    return new Promise((resolve, reject) => {
      const transactions = [];
      const qualityIssues = [];
      let rowIndex = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          rowIndex++;

          // Normalize CSV keys (handle different column names)
          const normalizedRow = this._normalizeCSVRow(row, source);

          const { isValid, issues, normalizedRow: validated } = validateTransaction(
            normalizedRow,
            source
          );

          if (!isValid) {
            qualityIssues.push({
              source,
              originalRowIndex: rowIndex,
              rowData: row,
              issues,
              severity: 'warning',
            });
          }

          // Store transaction regardless of validity (for audit trail)
          if (
            validated.transactionId &&
            validated.type &&
            validated.asset &&
            validated.quantity &&
            validated.timestamp
          ) {
            try {
              const txn = {
                transactionId: validated.transactionId,
                type: validated.type.toUpperCase(),
                asset: validated.asset,
                quantity: new Decimal(validated.quantity),
                price: validated.price ? new Decimal(validated.price) : null,
                timestamp: new Date(validated.timestamp),
                rawData: row,
                dataQualityFlags: issues,
              };

              transactions.push(txn);
            } catch (error) {
              qualityIssues.push({
                source,
                originalRowIndex: rowIndex,
                rowData: row,
                issues: [...issues, `Processing error: ${error.message}`],
                severity: 'critical',
              });
            }
          }
        })
        .on('end', async () => {
          try {
            // Save quality issues
            if (qualityIssues.length > 0) {
              await DataQualityIssue.insertMany(qualityIssues);
            }

            // Clear existing transactions for this source
            await Model.deleteMany({});

            // Save transactions
            if (transactions.length > 0) {
              await Model.insertMany(transactions);
            }

            resolve({
              success: true,
              transactionsIngested: transactions.length,
              qualityIssuesFound: qualityIssues.length,
              issues: qualityIssues,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  _normalizeCSVRow(row, source) {
    const normalized = {};

    if (source === 'user') {
      normalized.transactionId = row.transaction_id || '';
      normalized.type = row.type || '';
      normalized.asset = row.asset || '';
      normalized.quantity = row.quantity || '';
      normalized.price = row.price || '';
      normalized.timestamp = row.timestamp || '';
    } else if (source === 'exchange') {
      normalized.transactionId = row.tx_id || '';
      normalized.type = row.transaction_type || '';
      normalized.asset = row.coin || '';
      normalized.quantity = row.amount || '';
      normalized.price = row.rate || '';
      normalized.timestamp = row.tx_time || '';
    }

    return normalized;
  }
}

module.exports = new IngestionService();
