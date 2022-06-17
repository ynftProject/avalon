module.exports = {
    bsonValidate: true,
    fields: ['symbol','amount','receiver','memo'],
    validate: async (tx, ts, legitUser, cb) => {
        // for now, GC and YNFT-GC-LP are the only tokens
        // only GC mints are transactable
        if (typeof tx.data.symbol !== 'string' || (tx.data.symbol !== 'GC' && tx.data.symbol !== 'YNFT-GC-LP'))
            return cb(false, 'invalid symbol')
        
        if (!validate.bigint(tx.data.amount,false,false))
            return cb(false, 'invalid token amount')
        
        if (!validate.string(tx.data.receiver,config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid token receiver')

        if (!validate.string(tx.data.memo, config.memoMaxLength))
            return cb(false, 'invalid token transfer memo')

        let receiver = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        if (!receiver)
            return cb(false, 'receiver does not exist')
        
        let sender = await cache.findOnePromise('accounts',{ name: tx.sender })
        let tokenBal = BigInt(sender['token'+tx.data.symbol] || 0)
        let amount = BigInt(tx.data.amount)
        if (!sender['token'+tx.data.symbol] || tokenBal < amount)
            return cb(false, 'insufficient token balance')

        // token lock specifics
        if (tx.data.receiver !== config.gcExchangeName &&
            tx.data.symbol === 'GC' &&
            sender['tokenGCLock'] &&
            tokenBal - BigInt(sender['tokenGCLock']) < amount)
            return cb(false, 'cannot move locked GC tokens')

        cb(true)
    },
    execute: async (tx, ts, cb) => {
        if (tx.sender !== config.burnAccount) {
            let amount = BigInt(tx.data.amount)
            let sender = await cache.findOnePromise('accounts',{ name: tx.sender })
            let newBalance = BigInt(sender['token'+tx.data.symbol]) - amount
            await cache.updateOnePromise('accounts',{ name: tx.sender },{$set:{
                ['token'+tx.data.symbol]: newBalance.toString()
            }})

            // unlock gc token if sending to gc exchange account
            if (tx.data.receiver === config.gcExchangeName && sender.GCLock && BigInt(sender.GCLock) > 0n) {
                let gcUnlocked = BigInt(sender.GCLock)
                if (gcUnlocked > amount)
                    gcUnlocked = amount
                await cache.updateOnePromise('accounts',{ name: tx.sender },{$set:{
                    tokenGCLock: (BigInt(sender.GCLock) - gcUnlocked).toString()
                }})
                let tokenSupply = await cache.findOnePromise('state',{_id: 3})
                await cache.updateOnePromise('state',{_id: 3},{$set:{GCLock: (BigInt(tokenSupply.GCLock)-gcUnlocked).toString() }})
            }
        } else {
            let tokenSupply = await cache.findOnePromise('state',{_id: 3})
            await cache.updateOnePromise('state',{_id: 3},{$set:{[tx.data.symbol]: (BigInt(tokenSupply[tx.data.symbol] || 0)+BigInt(tx.data.amount)).toString() }})
        }
        if (tx.data.receiver !== config.burnAccount) {
            let receiver = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
            let newBalance = BigInt(receiver['token'+tx.data.symbol] || 0) + BigInt(tx.data.amount)
            await cache.updateOnePromise('accounts',{ name: tx.data.receiver },{$set:{
                ['token'+tx.data.symbol]: newBalance.toString()
            }})
        } else {
            let tokenSupply = await cache.findOnePromise('state',{_id: 3})
            await cache.updateOnePromise('state',{_id: 3},{$set:{[tx.data.symbol]: (BigInt(tokenSupply[tx.data.symbol])-BigInt(tx.data.amount)).toString() }})
        }
        cb(true)
    }
}