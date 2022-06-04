const sqrt = require('bigint-isqrt')

let amm = {
    liquidityAdd: async (tx) => {
        let pool = await cache.findOnePromise('ammPools',{ _id: 'ynft/'+tx.data.tokenSymbol })
        let ynftIn = 0n
        let tokenIn = 0n
        let lpOutput = 0n
        let ynftAmount = BigInt(tx.data.ynftAmount)
        let tokenAmount = BigInt(tx.data.tokenAmount)
        if (!pool || !pool.ynft || !pool[tx.data.tokenSymbol]) {
            // first liquidity provider
            ynftIn = ynftAmount
            tokenIn = tokenAmount
            lpOutput = sqrt(ynftIn*tokenIn)
        } else {
            // subsequent liquidity provider (price impact may occur due to rounding)
            let ynftBal = BigInt(pool.ynft)
            let tokenBal = BigInt(pool[tx.data.tokenSymbol])
            let tokenPrice = (10n**BigInt(config.ammPricePrecision))*ynftBal/tokenBal
            let tokenAmountYnftValue = tokenAmount*tokenPrice/10n**BigInt(config.ammPricePrecision)
            if (tokenAmountYnftValue <= ynftAmount) {
                ynftIn = tokenAmountYnftValue
                tokenIn = tokenAmount
            } else {
                ynftIn = ynftAmount
                tokenIn = (10n**BigInt(config.ammPricePrecision))*ynftAmount/tokenPrice
            }
            let oldK = ynftBal*tokenBal
            lpOutput = (BigInt(pool.lpSupply)*((ynftBal+ynftIn)*tokenBal - oldK)/oldK)
        }
        return { ynftIn, tokenIn, lpOutput, pool }
    },
    liquidityRemove: async (tx) => {
        let pool = await cache.findOnePromise('ammPools',{ _id: 'ynft/'+tx.data.tokenSymbol })
        if (!pool)
            return { error: 'liquidity pool does not exist' }
        let ynftOut = BigInt(pool.ynft)*BigInt(tx.data.lpAmount)/BigInt(pool.lpSupply)
        let tokenOut = BigInt(pool[tx.data.tokenSymbol])*BigInt(tx.data.lpAmount)/BigInt(pool.lpSupply)
        return { error: null, pool, ynftOut, tokenOut }
    },
    swapExact: async (tx) => {
        let poolID = ''
        let tokenInSymbol = ''
        let tokenOutSymbol = ''
        let tokenOutAmount = 0n
        // for now assume all pools contain YNFT native token
        if (tx.data.tokenInSymbol === 'YNFT') {
            poolID = 'ynft/'+tx.data.tokenOutSymbol
            tokenInSymbol = 'ynft'
            tokenOutSymbol = tx.data.tokenOutSymbol
        } else if (tx.data.tokenOutSymbol === 'YNFT') {
            poolID = 'ynft/'+tx.data.tokenInSymbol
            tokenInSymbol = tx.data.tokenInSymbol
            tokenOutSymbol = 'ynft'
        }
        let pool = await cache.findOnePromise('ammPools',{ _id: poolID })
        if (!pool)
            return { error: 'liquidity pool does not exist' }
        else if (!pool[tokenInSymbol] || !pool[tokenOutSymbol])
            return { error: 'no liquidity in pool to execute swap' }
        let tokenInBal = BigInt(pool[tokenInSymbol])
        let tokenOutBal = BigInt(pool[tokenOutSymbol])
        let k = tokenInBal*tokenOutBal
        tokenOutAmount = (tokenOutBal - (k/(tokenInBal+BigInt(tx.data.tokenInAmount))))*BigInt(10000-config.ammFee)/10000n
        if (tokenOutAmount <= 0n)
            return { error: 'non-positive token output' }
        else if (tokenOutBal - tokenOutAmount <= 0n)
            return { error: 'insufficient liquidity to execute swap' }
        else
            return { error: null, pool, tokenOutAmount }
    },
    swapForExact: async (tx) => {
        let poolID = ''
        let tokenInSymbol = ''
        let tokenOutSymbol = ''
        let tokenInAmount = 0n
        // for now assume all pools contain YNFT native token
        if (tx.data.tokenInSymbol === 'YNFT') {
            poolID = 'ynft/'+tx.data.tokenOutSymbol
            tokenInSymbol = 'ynft'
            tokenOutSymbol = tx.data.tokenOutSymbol
        } else if (tx.data.tokenOutSymbol === 'YNFT') {
            poolID = 'ynft/'+tx.data.tokenInSymbol
            tokenInSymbol = tx.data.tokenInSymbol
            tokenOutSymbol = 'ynft'
        }
        let pool = await cache.findOnePromise('ammPools',{ _id: poolID })
        if (!pool)
            return { error: 'liquidity pool does not exist' }
        else if (!pool[tokenInSymbol] || !pool[tokenOutSymbol])
            return { error: 'no liquidity in pool to execute swap' }
        else if (pool[tokenOutSymbol] - tx.data.tokenOutAmount <= 0)
            return { error: 'insufficient liquidity to execute swap' }
        let tokenInBal = BigInt(pool[tokenInSymbol])
        let tokenOutBal = BigInt(pool[tokenOutSymbol])
        let k = tokenInBal*tokenOutBal
        tokenInAmount = ((k/(tokenOutBal-BigInt(tx.data.tokenOutAmount)))-tokenInBal)*BigInt(10000+config.ammFee)/10000n
        if (tokenInAmount <= 0n)
            return { error: 'non-positive token input' }
        else
            return { error: null, pool, tokenInAmount }
    }
}

module.exports = amm