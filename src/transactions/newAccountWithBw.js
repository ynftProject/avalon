const GrowInt = require('growint')

module.exports = {
    fields: ['name', 'pub', 'bw'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.integer(tx.data.bw,false,false))
            return cb(false,'bw must be a valid positive integer')

        require('./newAccount').validate(tx,ts,legitUser,(valid,error) => {
            if (!valid)
                return cb(false,error)
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                let bwBefore = new GrowInt(account.bw, {growth:Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth)}).grow(ts)
                if (bwBefore.v < tx.data.amount)
                    cb(false, 'invalid tx not enough bw')
                else
                    cb(true)
            })
            
        })
    },
    execute: async (tx, ts, cb) => {
        // same as NEW_ACCOUNT but with starting tx.data.bw bytes
        // bandwidth debited from account creator in collectGrowInts() method in transaction.js
        let newAccBw = {v:tx.data.bw,t:ts}
        let newAccVt = {v:0,t:0}
        let baseBwGrowth = 0
        if (config.preloadBwGrowth && (!config.masterNoPreloadAcc || tx.sender !== config.masterName || config.masterPaysForUsernames))
            baseBwGrowth = Math.floor(eco.accountPrice(tx.data.name)/config.preloadBwGrowth)
        await cache.insertOnePromise('accounts', {
            name: tx.data.name.toLowerCase(),
            pub: tx.data.pub,
            balance: 0,
            voteLock: 0,
            bw: newAccBw,
            vt: newAccVt,
            baseBwGrowth: baseBwGrowth,
            follows: [],
            followers: [],
            keys: [],
            proposalVotes: [],
            nftBids: {},
            verified: 0,
            created: {
                by: tx.sender,
                ts: ts
            }
        })
        await eco.incrementAccount()
        if (tx.sender !== config.masterName || config.masterPaysForUsernames) {
            await cache.updateOnePromise('accounts', 
                {name: tx.sender},
                {$inc: {balance: -eco.accountPrice(tx.data.name)}})
            let acc = await cache.findOnePromise('accounts', {name: tx.sender})
            // update his bandwidth
            acc.balance += eco.accountPrice(tx.data.name)
            await transaction.updateIntsAndNodeApprPromise(acc,ts,-eco.accountPrice(tx.data.name))
            cb(true, null, eco.accountPrice(tx.data.name))
        } else cb(true)
    }
}