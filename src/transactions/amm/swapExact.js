const amm = require('../../amm')
const dao = require('../../dao')
const txHistory = require('../../txHistory')

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

        if (tx.data.tokenInSymbol === 'YNFT') {
            let swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
            let avail = dao.availableBalance(swapper,ts)
            if (tx.data.tokenOutSymbol === 'GC' && swapper.earningLock)
                avail += swapper.earningLock
            if (avail < Number(tx.data.tokenInAmount))
                return cb(false, 'insufficient ynft balance')
            return cb(true)
        } else if (tx.data.tokenInSymbol !== 'YNFT')
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
        let event = {
            tokenOutAmount: output.tokenOutAmount.toString()
        }
        if (tx.data.tokenInSymbol === 'YNFT') {
            let ynftAmtInt = Number(tx.data.tokenInAmount)
            let unlockYnftAmtInt = 0
            let set = {}
            let swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
            await transaction.updateIntsAndNodeApprPromise(swapper,ts,-ynftAmtInt)
            if (tx.data.tokenOutSymbol === 'GC' && swapper.earningLock) {
                unlockYnftAmtInt = Math.min(swapper.earningLock,ynftAmtInt)
                let unlockOutput = await amm.swapExact({
                    data: {
                        tokenInSymbol: tx.data.tokenInSymbol,
                        tokenInAmount: unlockYnftAmtInt,
                        tokenOutSymbol: 'GC'
                    }
                })
                logr.econ('Unlock '+unlockYnftAmtInt+' YNFT for '+unlockOutput.tokenOutAmount+' locked GC')
                event.tokenOutLocked = unlockOutput.tokenOutAmount.toString()
                event.ynftUnlocked = unlockYnftAmtInt.toString()
                await require('../token/transfer').execute({
                    data: {
                        symbol: 'GCLock',
                        amount: unlockOutput.tokenOutAmount,
                        receiver: tx.sender
                    },
                    sender: config.burnAccount
                },ts,() => {})
            }
            if (unlockYnftAmtInt < ynftAmtInt) {
                swapper = await cache.findOnePromise('accounts',{ name: tx.sender })
                let deduction = Math.ceil(swapper.vt.v*(ynftAmtInt-unlockYnftAmtInt)/(swapper.balance-unlockYnftAmtInt))
                swapper.vt.v -= deduction
                set.vt = swapper.vt
                await transaction.adjustTvap(-deduction)
            }
            await cache.updateOnePromise('accounts',{ name: tx.sender },{
                $inc: { balance: -ynftAmtInt, earningLock: -unlockYnftAmtInt },
                $set: set
            })
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
        txHistory.logEvent(tx.hash,event)
        cb(true)
    }
}