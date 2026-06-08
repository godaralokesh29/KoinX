const mongoose = require('mongoose');

const dataQualityIssueSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['user', 'exchange'], required: true },
    originalRowIndex: Number,
    rowData: mongoose.Schema.Types.Mixed,
    issues: [String],
    severity: { type: String, enum: ['critical', 'warning'], default: 'warning' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DataQualityIssue', dataQualityIssueSchema);
