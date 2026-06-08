const mongoose = require('mongoose');

const userTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, sparse: true, index: true },
    type: { type: String, required: true },
    asset: { type: String, required: true, index: true },
    quantity: { type: mongoose.Schema.Types.Decimal128, required: true },
    price: { type: mongoose.Schema.Types.Decimal128, default: null },
    timestamp: { type: Date, required: true, index: true },
    rawData: { type: mongoose.Schema.Types.Mixed, required: true },
    dataQualityFlags: [String],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserTransaction', userTransactionSchema);
