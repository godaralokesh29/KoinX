const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema(
  {
    runId: { type: String, unique: true, required: true, index: true },
    startTime: Date,
    endTime: Date,
    config: {
      timestampToleranceSeconds: Number,
      quantityTolerancePct: Number,
    },
    results: {
      matched: [mongoose.Schema.Types.Mixed],
      conflicting: [mongoose.Schema.Types.Mixed],
      unmatchedUser: [mongoose.Schema.Types.Mixed],
      unmatchedExchange: [mongoose.Schema.Types.Mixed],
    },
    summary: {
      totalMatched: Number,
      totalConflicting: Number,
      totalUnmatchedUser: Number,
      totalUnmatchedExchange: Number,
    },
    csvReport: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReconciliationRun', reconciliationRunSchema);
