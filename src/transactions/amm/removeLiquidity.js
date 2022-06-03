const amm = require('../../amm')

module.exports = {
    fields: ['tokenSymbol','lpAmount','tokenOutMin','ynftOutMin'],
    validate: async (tx, ts, legitUser, cb) => {
        if (typeof tx.data.tokenSymbol !== 'string' || tx.data.tokenSymbol !== 'GC')
            return cb(false, 'invalid token symbol')
        
        if (!validate.bigint(tx.data.lpAmount,false,false))
            return cb(false, 'invalid LP token amount to be removed')
        
        if (!validate.bigint(tx.data.tokenOutMin,false,false))
            return cb(false, 'invalid expected token output minimum')

        if (!validate.integer(tx.data.ynftOutMin,false,false))
            return cb(false, 'invalid expected ynft output minimum')

        let output = await amm.liquidityRemove(tx)
        if (output.error)
            return cb(false, output.error)
        else if (output.tokenOut < BigInt(tx.data.tokenOutMin))
            return cb(false, 'insufficient token output')
        else if (output.ynftOut < BigInt(tx.data.ynftOutMin))
            return cb(false, 'insufficient ynft output')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let output = await amm.liquidityRemove(tx)
        logr.econ('Remove '+output.ynftOut+' YNFT and '+output.tokenOut+' '+tx.data.tokenSymbol+' liquidity')
        await cache.updateOnePromise('ammPools',{ _id: 'ynft/'+tx.data.tokenSymbol },{$set: {
            ynft: (BigInt(output.pool.ynft) - output.ynftOut).toString(),
            [tx.data.tokenSymbol]: (BigInt(output.pool[tx.data.tokenSymbol]) - output.tokenOut).toString(),
            lpSupply: (BigInt(output.pool.lpSupply) - BigInt(tx.data.lpAmount)).toString()
        }})

        let remover = await cache.findOnePromise('accounts',{ name: tx.sender })
        await cache.updateOnePromise('accounts',{ name: tx.sender },{ $inc: { balance: Number(output.ynftOut) }})
        await transaction.updateIntsAndNodeApprPromise(remover,ts,Number(output.ynftOut))

        await require('../token/transfer').execute({
            data: {
                symbol: tx.data.tokenSymbol,
                amount: output.tokenOut,
                receiver: tx.sender
            },
            sender: config.burnAccount
        },ts,() => {})
        await require('../token/transfer').execute({
            data: {
                symbol: 'YNFT-'+tx.data.tokenSymbol+'-LP',
                amount: tx.data.lpAmount,
                receiver: config.burnAccount
            },
            sender: tx.sender
        },ts,() => {})
        cb(true)
    }
}