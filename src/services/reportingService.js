const ReconciliationRun = require('../models/ReconciliationRun');
const { v4: uuidv4 } = require('uuid');

class ReportingService {
  async generateReport(matchResults, config) {
    const runId = uuidv4();

    const summary = {
      totalMatched: matchResults.matched.length,
      totalConflicting: matchResults.conflicting.length,
      totalUnmatchedUser: matchResults.unmatchedUser.length,
      totalUnmatchedExchange: matchResults.unmatchedExchange.length,
    };

    const csvReport = this._generateCSVReport(matchResults);

    const run = new ReconciliationRun({
      runId,
      startTime: new Date(),
      endTime: new Date(),
      config: {
        timestampToleranceSeconds: config.TIMESTAMP_TOLERANCE_SECONDS,
        quantityTolerancePct: config.QUANTITY_TOLERANCE_PCT,
      },
      results: matchResults,
      summary,
      csvReport,
    });

    await run.save();

    return { runId, summary, csvReport };
  }

  _generateCSVReport(matchResults) {
    const lines = [];

    // Header
    lines.push(
      'category,userTransactionId,userType,userAsset,userQuantity,userPrice,userTimestamp,' +
        'exchangeTransactionId,exchangeType,exchangeAsset,exchangeQuantity,exchangePrice,exchangeTimestamp,' +
        'matchReason,discrepancies,source'
    );

    // Matched transactions
    for (const match of matchResults.matched) {
      const user = match.userTransaction;
      const exchange = match.exchangeTransaction;
      lines.push(
        this._escapeCSVLine([
          'MATCHED',
          user.transactionId,
          user.type,
          user.asset,
          user.quantity,
          user.price || '',
          user.timestamp,
          exchange.transactionId,
          exchange.type,
          exchange.asset,
          exchange.quantity,
          exchange.price || '',
          exchange.timestamp,
          match.matchReason,
          '',
          '',
        ])
      );
    }

    // Conflicting transactions
    for (const conflict of matchResults.conflicting) {
      const user = conflict.userTransaction;
      const exchange = conflict.exchangeTransaction;
      lines.push(
        this._escapeCSVLine([
          'CONFLICTING',
          user.transactionId,
          user.type,
          user.asset,
          user.quantity,
          user.price || '',
          user.timestamp,
          exchange.transactionId,
          exchange.type,
          exchange.asset,
          exchange.quantity,
          exchange.price || '',
          exchange.timestamp,
          conflict.matchReason,
          (conflict.discrepancies || []).join('; '),
          '',
        ])
      );
    }

    // Unmatched user transactions
    for (const unmatched of matchResults.unmatchedUser) {
      const user = unmatched.transaction;
      lines.push(
        this._escapeCSVLine([
          'UNMATCHED_USER',
          user.transactionId,
          user.type,
          user.asset,
          user.quantity,
          user.price || '',
          user.timestamp,
          '',
          '',
          '',
          '',
          '',
          '',
          unmatched.reason,
          '',
          'user',
        ])
      );
    }

    // Unmatched exchange transactions
    for (const unmatched of matchResults.unmatchedExchange) {
      const exchange = unmatched.transaction;
      lines.push(
        this._escapeCSVLine([
          'UNMATCHED_EXCHANGE',
          '',
          '',
          '',
          '',
          '',
          '',
          exchange.transactionId,
          exchange.type,
          exchange.asset,
          exchange.quantity,
          exchange.price || '',
          exchange.timestamp,
          unmatched.reason,
          '',
          'exchange',
        ])
      );
    }

    return lines.join('\n');
  }

  _escapeCSVLine(fields) {
    return fields
      .map((field) => {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  }

  async getReport(runId) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new Error(`Reconciliation run ${runId} not found`);
    }
    return run;
  }

  async getReportSummary(runId) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new Error(`Reconciliation run ${runId} not found`);
    }
    return run.summary;
  }

  async getUnmatchedTransactions(runId) {
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      throw new Error(`Reconciliation run ${runId} not found`);
    }
    return {
      unmatched_user: run.results.unmatchedUser,
      unmatched_exchange: run.results.unmatchedExchange,
    };
  }
}

module.exports = new ReportingService();
