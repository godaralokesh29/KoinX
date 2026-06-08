const express = require('express');
const ingestionService = require('../../services/ingestionService');
const matchingEngine = require('../../services/matchingEngine');
const reportingService = require('../../services/reportingService');
const UserTransaction = require('../../models/UserTransaction');
const ExchangeTransaction = require('../../models/ExchangeTransaction');
const { getConfig } = require('../../config/reconciliationConfig');

const router = express.Router();

router.post('/reconcile', async (req, res, next) => {
  try {
    const configOverrides = req.body.config || {};

    // Ingest transactions
    const userResult = await ingestionService.ingestUserTransactions(
      `${process.cwd()}/data/user_transactions.csv`
    );
    const exchangeResult = await ingestionService.ingestExchangeTransactions(
      `${process.cwd()}/data/exchange_transactions.csv`
    );

    console.log(`Ingested ${userResult.transactionsIngested} user transactions`);
    console.log(`Ingested ${exchangeResult.transactionsIngested} exchange transactions`);
    console.log(`Found ${userResult.qualityIssuesFound} user data quality issues`);
    console.log(`Found ${exchangeResult.qualityIssuesFound} exchange data quality issues`);

    // Fetch transactions
    const userTxns = await UserTransaction.find();
    const exchangeTxns = await ExchangeTransaction.find();

    // Run matching
    const matchResults = await matchingEngine.matchTransactions(
      userTxns,
      exchangeTxns,
      configOverrides
    );

    // Generate report
    const config = getConfig(configOverrides);
    const reportResult = await reportingService.generateReport(matchResults, config);

    res.json({
      success: true,
      runId: reportResult.runId,
      message: 'Reconciliation completed',
      startTime: new Date().toISOString(),
      ingestion: {
        userTransactions: userResult,
        exchangeTransactions: exchangeResult,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/report/:runId', async (req, res, next) => {
  try {
    const report = await reportingService.getReport(req.params.runId);

    res.set('Content-Type', 'application/json');
    res.json({
      runId: report.runId,
      config: report.config,
      summary: report.summary,
      results: {
        matched: report.results.matched,
        conflicting: report.results.conflicting,
        unmatchedUser: report.results.unmatchedUser,
        unmatchedExchange: report.results.unmatchedExchange,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/report/:runId/summary', async (req, res, next) => {
  try {
    const summary = await reportingService.getReportSummary(req.params.runId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/report/:runId/unmatched', async (req, res, next) => {
  try {
    const unmatched = await reportingService.getUnmatchedTransactions(req.params.runId);
    res.json(unmatched);
  } catch (error) {
    next(error);
  }
});

router.get('/report/:runId/csv', async (req, res, next) => {
  try {
    const report = await reportingService.getReport(req.params.runId);

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="reconciliation-${req.params.runId}.csv"`);
    res.send(report.csvReport);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
