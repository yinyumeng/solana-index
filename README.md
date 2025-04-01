# Solana Block Indexer

A Node.js application for indexing and processing Solana blockchain transactions. This tool helps analyze and track token transfers and transactions within Solana blocks.

## Features

- Index Solana blocks by slot number using RPC endpoints
- Parse and analyze token transfer data from transactions
- Determine transaction types (buy, sell, add, remove, transfer)
- Track pre and post token balances
- Process multiple transactions within a block efficiently
- Retry mechanism for failed transaction lookups

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/solana-block-indexer.git
cd solana-block-indexer
```

2. Install dependencies:
```bash
npm install
```

## Dependencies

- @solana/web3.js: ^1.98.0 - Official Solana web3 library for blockchain interaction
- axios: ^1.8.4 - HTTP client for making API requests

## Core Functions

### indexSolanaBlock(slot, rpcInput)
- Fetches and processes a Solana block at the specified slot number
- Parameters:
  - slot: The slot number to index
  - rpcInput: Optional RPC endpoint (defaults to Solana mainnet)
- Includes retry mechanism for failed transaction lookups

### parseTokenTransfers(transactionData)
- Analyzes token transfers within a transaction
- Tracks pre and post token balances
- Processes account changes and token movements

### determineTransactionType(preAmount, postAmount)
- Categorizes transactions into types: buy, sell, add, remove, or burn
- Based on comparing pre and post token amounts

## Usage

```javascript
const { indexSolanaBlock } = require('./index.js');

// Index a specific block by slot number
await indexSolanaBlock(slot_number);

// Or specify a custom RPC endpoint
await indexSolanaBlock(slot_number, 'https://your-rpc-endpoint.com');
```

## Error Handling

The indexer includes built-in error handling mechanisms:
- Retries failed transaction lookups up to 5 times
- Gracefully handles missing blocks
- Validates token transfer data

## Notes

- Uses BigInt for precise token amount calculations
- Supports all types of token transfers and balance changes
- Compatible with Solana mainnet and custom RPC endpoints



- `indexSolanaBlock(slot, rpcInput)`: Index a specific Solana block by its slot number
- `determineTransactionType(changeAmount)`: Analyze and categorize transaction types
- `parseTokenTransfers(transactionData)`: Extract token transfer information from transactions

Example usage:
```javascript
const { indexSolanaBlock } = require('./index.js');

// Index a specific block
const slot = 123456789;
const rpcEndpoint = 'https://api.mainnet-beta.solana.com';
await indexSolanaBlock(slot, rpcEndpoint);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.