// test.js
const { indexSolanaBlock } = require('./index');
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');

async function runTest() {
  try {
    // Test with the current slot (or specify a specific slot number)
    const rpc = 'https://api.mainnet-beta.solana.com';
    connection = new Connection(rpc, 'confirmed');
    const currentSlot = await connection.getSlot();
    const blockData = await indexSolanaBlock(currentSlot, rpc);
    console.log('Test completed successfully!');
    
    // Optional: Log some summary data
    if (blockData) {
      console.log(`Block ${blockData.slot} contained ${blockData.length} transactions`);
      console.log(`Block time: ${blockData.blockTime}`);
      
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

runTest();
