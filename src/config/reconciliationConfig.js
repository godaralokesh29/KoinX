const DEFAULT_CONFIG = {
  TIMESTAMP_TOLERANCE_SECONDS: parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS || '300'),
  QUANTITY_TOLERANCE_PCT: parseFloat(process.env.QUANTITY_TOLERANCE_PCT || '0.01'),
  ASSET_ALIASES: {
    BTC: ['Bitcoin', 'bitcoin'],
    ETH: ['Ethereum', 'ethereum'],
    USDT: ['Tether', 'tether'],
    USDC: ['USD Coin', 'usd-coin'],
    ADA: ['Cardano', 'cardano'],
    SOL: ['Solana', 'solana'],
  },
  TRANSACTION_TYPE_MAPPINGS: {
    TRANSFER_IN: ['TRANSFER_OUT'],
    TRANSFER_OUT: ['TRANSFER_IN'],
  },
  VALID_TRANSACTION_TYPES: ['TRANSFER_IN', 'TRANSFER_OUT', 'BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL'],
};

const getConfig = (overrides = {}) => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

module.exports = { DEFAULT_CONFIG, getConfig };
