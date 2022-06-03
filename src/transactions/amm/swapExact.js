const amm = require('../../amm')
const dao = require('../../dao')

module.exports = {
    fields: ['tokenInSymbol','tokenInAmount','tokenOutSymbol','tokenOutMin'],
    validate: async (tx, ts, legitUser, cb) => {
        if (typeof tx.data.tokenInSymbol !== 'string' || (tx.data.tokenInSymbol !== 'GC' && tx.data.tokenInSymbol !== 'YNFT'))
            return cb(false, 'invalid token input symbol')

        if (typeof tx.data.tokenOutSymbol !== 'string' || (tx.data.tokenOutSymbol !== 'GC' && tx.data.tokenOutSymbol !== 'YNFT'))
            return cb(false, 'invalid token output symbol')

        if (!validate.bigint(tx.data.tokenInAmount,false,false))
            return cb(false, 'invalid exact token input amount to be swapped')

        if (!validate.bigint(tx.data.tokenOutMin,false,false))
            return cb(false, 'invalid expected output token amount')

        if (tx.data.tokenInSymbol === tx.data.tokenOutSymbol)
            return cb(false, 'token in symbol must not be the same as token out symbol')

        let output = await amm.swapExact(tx)
        if (output.error)
            return cb(false, output.error)
        else if (output.tokenOutAmount < BigInt(tx.data.tokenOutMin))
            return cb(false, 'insufficient token output')

        let swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
        if (tx.data.tokenInSymbol === 'YNFT' && dao.availableBalance(swapper,ts) < Number(tx.data.tokenInAmount))
            return cb(false, 'insufficient ynft balance')
        else if (tx.data.tokenInSymbol !== 'YNFT')
            require('../token/transfer').validate({
                data: {
                    symbol: tx.data.tokenInSymbol,
                    amount: tx.data.tokenInAmount,
                    receiver: config.burnAccount,
                    memo: ''
                },
                sender: tx.sender
            },ts,legitUser,(valid, error) => {
                if (!valid)
                    return cb(false, error)
                return cb(true)
            })
        else
            return cb(true)
    },
    execute: async (tx, ts, cb) => {
        let output = await amm.swapExact(tx)
        let poolChanges = {$set:{}}
        logr.econ('Swap exactly '+tx.data.tokenInAmount+' '+tx.data.tokenInSymbol+' for '+output.tokenOutAmount+' '+tx.data.tokenOutSymbol)
        if (tx.data.tokenInSymbol === 'YNFT') {
            let ynftAmtInt = Number(tx.data.tokenInAmount)
            let swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
            await transaction.updateIntsAndNodeApprPromise(swapper,ts,-ynftAmtInt)
            swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
            let deduction = Math.ceil(swapper.vt.v*ynftAmtInt/swapper.balance)
            swapper.vt.v -= deduction
            await cache.updateOnePromise('accounts',{ name: tx.sender },{
                $inc: { balance: -ynftAmtInt },
                $set: { vt: swapper.vt }
            })
            await transaction.adjustTvap(-deduction)
            poolChanges.$set.ynft = (BigInt(output.pool.ynft) + BigInt(tx.data.tokenInAmount)).toString()
        } else {
            await require('../token/transfer').execute({
                data: {
                    symbol: tx.data.tokenInSymbol,
                    amount: tx.data.tokenInAmount,
                    receiver: config.burnAccount
                },
                sender: tx.sender
            },ts,() => {})
            poolChanges.$set[tx.data.tokenInSymbol] = (BigInt(output.pool[tx.data.tokenInSymbol]) + BigInt(tx.data.tokenInAmount)).toString()
        }
        if (tx.data.tokenOutSymbol === 'YNFT') {
            let swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
            await cache.updateOnePromise('accounts',{ name: tx.sender },{$inc: {balance: Number(output.tokenOutAmount)}})
            await transaction.updateIntsAndNodeApprPromise(swapper,ts,Number(output.tokenOutAmount))
            poolChanges.$set.ynft = (BigInt(output.pool.ynft) - output.tokenOutAmount).toString()
        } else {
            await require('../token/transfer').execute({
                data: {
                    symbol: tx.data.tokenOutSymbol,
                    amount: output.tokenOutAmount,
                    receiver: tx.sender
                },
                sender: config.burnAccount
            },ts,() => {})
            poolChanges.$set[tx.data.tokenOutSymbol] = (BigInt(output.pool[tx.data.tokenOutSymbol]) - output.tokenOutAmount).toString()
        }
        await cache.updateOnePromise('ammPools', { _id: output.pool._id },poolChanges)
        cb(true)
    }
}