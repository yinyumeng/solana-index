// index.js
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

let rpc;
let connection;

function determineTransactionType(preAmount, postAmount) {
    const pre = BigInt(preAmount);
    const post = BigInt(postAmount);
    if (pre > post) {
        return post === 0n ? 'remove' : 'sell';
    }
    if (post > pre) {
        return pre === 0n ? 'add' : 'buy';
    }
    return 'transfer';
}

// Function to parse token transfers
async function parseTokenTransfers(transactionData) {
    const preBalances = transactionData.tokenTransfers?.preTokenBalances || [];
    const postBalances = transactionData.tokenTransfers?.postTokenBalances || [];

    // Create a dictionary to track changes by account index
    const accountChanges = {};

    // Process pre-balances
    preBalances.forEach(balance => {
        const accountIndex = balance.accountIndex;
        accountChanges[accountIndex] = {
            mint: balance.mint,
            owner: balance.owner,
            preAmount: balance.uiTokenAmount.amount,
            preUiAmount: balance.uiTokenAmount.uiAmountString,
            decimals: balance.uiTokenAmount.decimals,
            postAmount: "0",
            postUiAmount: "0",
            changeAmount: "0",
            changeUiAmount: "0"
        };
    });

    // Process post-balances and calculate changes
    postBalances.forEach(balance => {
        const accountIndex = balance.accountIndex;
        const postAmount = balance.uiTokenAmount.amount;
        const postUiAmount = balance.uiTokenAmount.uiAmountString;

        if (accountChanges[accountIndex]) {
            accountChanges[accountIndex].postAmount = postAmount;
            accountChanges[accountIndex].postUiAmount = postUiAmount;

            // Calculate change
            const preAmount = BigInt(accountChanges[accountIndex].preAmount);
            const postAmountBigInt = BigInt(postAmount);
            const changeAmount = postAmountBigInt - preAmount;

            // Calculate UI change
            const preUi = parseFloat(accountChanges[accountIndex].preUiAmount);
            const postUi = parseFloat(postUiAmount);
            const changeUi = postUi - preUi;

            accountChanges[accountIndex].changeAmount = changeAmount.toString();
            accountChanges[accountIndex].changeUiAmount = changeUi.toString();
        } else {
            // New token account that wasn't in pre-balances
            accountChanges[accountIndex] = {
                mint: balance.mint,
                owner: balance.owner,
                preAmount: "0",
                preUiAmount: "0",
                decimals: balance.uiTokenAmount.decimals,
                postAmount: postAmount,
                postUiAmount: postUiAmount,
                changeAmount: postAmount,
                changeUiAmount: postUiAmount
            };
        }
    });

    // Check and update accountChanges where postAmount is 0n
    for (const [accountIndex, data] of Object.entries(accountChanges)) {
        if (data.postAmount === "0") {
            accountChanges[accountIndex] = {
                ...data,
                changeAmount: '-'+data.preAmount,
                changeUiAmount: '-'+data.preUiAmount
            };
        }
    }

    // Convert to an array for easier display
    const transferRecords = [];

    // Add additional transaction metadata
    for (const [accountIndex, data] of Object.entries(accountChanges)) {
        // Get token metadata
        //   const tokenMetadata = await fetchTokenMetadata(data.mint);

        // Determine transaction type
        const txType = determineTransactionType(data.preAmount, data.postAmount);

        let detailedType = txType;

        // Track total changes for each mint to determine burn
        const mintChanges = {};
        for (const change of Object.values(accountChanges)) {
            if (change.mint === data.mint) {
                const changeAmt = BigInt(change.changeAmount);
                mintChanges[change.mint] = (mintChanges[change.mint] || 0n) + changeAmt;
            }
        }
        
        let isBurn = (txType === 'remove' || txType === 'sell') && 
                     (mintChanges[data.mint] || 0n) < 0n && BigInt(data.changeAmount) === mintChanges[data.mint];
        if (isBurn) {
            detailedType = 'burn';
        }

        transferRecords.push({
            signature: transactionData.signature,
            block: transactionData.slot,
            blockTime: transactionData.blockTime,
            accountIndex,
            mint: data.mint,
            owner: data.owner,
            makerAddress: transactionData.marker,
            decimals: data.decimals,
            preAmount: data.preAmount,
            preUiAmount: data.preUiAmount,
            postAmount: data.postAmount,
            postUiAmount: data.postUiAmount,
            changeAmount: data.changeAmount,
            changeUiAmount: data.changeUiAmount,
            type: detailedType,
            status: transactionData.status
        });
    }

    // Sort by absolute change value (descending)
    transferRecords.sort((a, b) => {
        return Math.abs(parseFloat(b.changeUiAmount)) - Math.abs(parseFloat(a.changeUiAmount));
    });
    // Filter to keep only records with positive changes
    const filteredRecords = transferRecords.filter(record => BigInt(record.changeAmount) != 0n);
    return filteredRecords;
}

/**
 * Fetches and indexes all transactions in a Solana block
 * @param {number} slot - The slot number of the block to index
 */
async function indexSolanaBlock(slot, rpcInput) {
    console.log(`Looking up Solana block at slot: ${slot}`);

    try {
        rpc = rpcInput ?? 'https://api.mainnet-beta.solana.com';
        connection = new Connection(rpc, 'confirmed');

        // Fetch the block
        const block = await connection.getBlock(slot, {
            maxSupportedTransactionVersion: 0,
            rewards: false,
            transactionDetails: 'full'
        });

        if (!block) {
            console.error('Block not found. It might be too old or on a different network.');
            return;
        }

        const allSignatures = block.transactions.flatMap(x => x.transaction.signatures);

        // Process each transaction in the block
        for (const transactionSignature of allSignatures) {
            let transaction = await connection.getParsedTransaction(
                transactionSignature,
                { maxSupportedTransactionVersion: 0 }
            );

            let retryCount = 0;
            while (!transaction && retryCount < 5) {
                retryCount++;
                console.log(`Retry attempt ${retryCount} for transaction ${transactionSignature}`);
                transaction = await connection.getParsedTransaction(
                    transactionSignature,
                    { maxSupportedTransactionVersion: 0 }
                );
                if (!transaction) {
                    // Add a small delay between retries
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!transaction) {
                console.error(`Transaction not found after ${retryCount} retries. It might be too old or on a different network.`);
                continue;
            }

            fs.writeFileSync(
                `./transaction_raw/${transactionSignature}.json`,
                JSON.stringify(transaction, null, 2)
            );
            console.log(`Transaction data saved to transaction_raw/${transactionSignature}.json`);

            // Extract key information
            const indexedData = {
                signature: transactionSignature,
                slot: transaction.slot,
                blockTime: transaction.blockTime ? new Date(transaction.blockTime * 1000).toISOString() : null,
                fee: transaction.meta?.fee || 0,
                status: transaction.meta?.err ? 'failed' : 'success',
                instructions: transaction.transaction.message.instructions.map((ix, index) => ({
                    programId: ix.programId?.toString(),
                    accounts: ix.accounts,
                    data: ix.data,
                    programName: ix.program
                })),
                signatures: transaction.transaction.signatures.map(sig => sig.toString()),
                recentBlockhash: transaction.transaction.message.recentBlockhash,
                marker: transaction.transaction.message.accountKeys.find(key => key.signer)?.pubkey.toString()
            };

            // Add token transfers if available
            if (transaction.meta?.postTokenBalances) {
                indexedData.tokenTransfers = {
                    preTokenBalances: transaction.meta.preTokenBalances,
                    postTokenBalances: transaction.meta.postTokenBalances
                };
            }

            // Add SOL transfers if available
            if (transaction.meta?.postBalances) {
                indexedData.balanceChanges = transaction.transaction.message.accountKeys.map((account, index) => ({
                    account: account.pubkey.toString(),
                    preSol: transaction.meta.preBalances[index], // Convert lamports to SOL
                    postSol: transaction.meta.postBalances[index],
                    change: (transaction.meta.postBalances[index] - transaction.meta.preBalances[index])
                }));
            }

            const transferRecords = await parseTokenTransfers(indexedData);

            console.log('Transaction successfully indexed');

            // Save to a JSON file (in a real app, you would likely save to a database)
            if (transferRecords.length > 0) {
                fs.writeFileSync(
                    `./transaction_processed/${transactionSignature}.json`,
                    JSON.stringify(transferRecords, null, 2)
                );
                console.log(`Transaction data saved to transaction_processed/${transactionSignature}.json`);
            }

        }

        return true;

    } catch (error) {
        console.error('Error fetching block:', error);

        if (error.message.includes('FetchError')) {
            console.log('Network error. Check your internet connection or try a different RPC endpoint.');
        } else if (error.message.includes('429')) {
            console.log('Rate limit exceeded. Try again later or use a different RPC endpoint.');
        }
    }
}

// Export the functions for use in other files
module.exports = {
    indexSolanaBlock
};
