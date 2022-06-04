const dao = require('../../dao')
const amm = require('../../amm')
const txHistory = require('../../txHistory')

module.exports = {
    fields: ['tokenSymbol','tokenAmount','ynftAmount','minOut'],
    validate: (tx, ts, legitUser, cb) => {
        // for now only GC token can be added
        if (typeof tx.data.tokenSymbol !== 'string' || tx.data.tokenSymbol !== 'GC')
            return cb(false, 'invalid token symbol')

        if (!validate.integer(tx.data.ynftAmount,false,false))
            return cb(false, 'invalid ynft amount')

        if (!validate.bigint(tx.data.minOut,false,false))
            return cb(false, 'invalid expected LP token output')

        if (dao.availableBalance(legitUser,ts) < tx.data.ynftAmount)
            return cb(false, 'insufficient ynft balance')

        require('../token/transfer').validate({
            data: {
                symbol: tx.data.tokenSymbol,
                amount: tx.data.tokenAmount,
                receiver: config.burnAccount,
                memo: ''
            },
            sender: tx.sender
        },ts,legitUser, async (valid, error) => {
            if (!valid)
                return cb(false, error)
            let output = await amm.liquidityAdd(tx)
            if (output.lpOutput < BigInt(tx.data.minOut))
                return cb(false, 'insufficient LP token output')
            return cb(true)
        })
    },
    execute: async (tx, ts, cb) => {
        let output = await amm.liquidityAdd(tx)
        // TODO transaction event triggers
        logr.econ('Add '+output.ynftIn+' YNFT and '+output.tokenIn+' '+tx.data.tokenSymbol+' liquidity')
        logr.econ('LP token output: '+output.lpOutput)
        if (!output.pool)
            await cache.insertOnePromise('ammPools',{
                _id: 'ynft/'+tx.data.tokenSymbol,
                ynft: output.ynftIn.toString(),
                [tx.data.tokenSymbol]: output.tokenIn.toString(),
                lpSupply: output.lpOutput.toString()
            })
        else
            await cache.updateOnePromise('ammPools',{ _id: 'ynft/'+tx.data.tokenSymbol },{
                $set: {
                    ynft: (BigInt(output.pool.ynft)+BigInt(output.ynftIn)).toString(),
                    [tx.data.tokenSymbol]: (BigInt(output.pool[tx.data.tokenSymbol])+BigInt(output.tokenIn)).toString(),
                    lpSupply: (BigInt(output.pool.lpSupply)+BigInt(output.lpOutput)).toString()
                }
            })

        // transfer ynft to pool and deduct VP proportionally
        let provider = await cache.findOnePromise('accounts', {name: tx.sender})
        await transaction.updateIntsAndNodeApprPromise(provider,ts,Number(-output.ynftIn))
        provider = await cache.findOnePromise('accounts', {name: tx.sender})
        let deduction = Math.ceil(provider.vt.v*Number(output.ynftIn)/provider.balance)
        provider.vt.v -= deduction
        await cache.updateOnePromise('accounts',{ name: tx.sender },{
            $inc: { balance: Number(-output.ynftIn) },
            $set: { vt: provider.vt }
        })
        await transaction.adjustTvap(-deduction)

        txHistory.logEvent(tx.hash, {
            ynftIn: output.ynftIn.toString(),
            tokenIn: output.tokenIn.toString(),
            lpOutput: output.lpOutput.toString()
        })

        await require('../token/transfer').execute({
            data: {
                symbol: tx.data.tokenSymbol,
                amount: output.tokenIn,
                receiver: config.burnAccount,
                memo: ''
            },
            sender: tx.sender
        },ts,() => {})
        require('../token/mint').execute({
            data: {
                symbol: 'YNFT-'+tx.data.tokenSymbol+'-LP',
                amount: output.lpOutput,
                receiver: tx.sender
            },
            sender: tx.sender
        },ts,() => cb(true))
    }
}