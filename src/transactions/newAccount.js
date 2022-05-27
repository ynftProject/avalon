const dao = require('../dao')
const GrowInt = require('growint')

module.exports = {
    fields: ['name', 'pub', 'bw', 'ref'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.name, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.name'); return
        }
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }
        if (!validate.integer(tx.data.bw,true,false))
            return cb(false,'bw must be a valid non-negative integer')
        if (!validate.string(tx.data.ref, config.accountMaxLength, 0, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid referrer account name')

        let lowerUser = tx.data.name.toLowerCase()

        for (let i = 0; i < lowerUser.length; i++) {
            const c = lowerUser[i]
            // allowed username chars
            if (config.allowedUsernameChars.indexOf(c) === -1) 
                if (config.allowedUsernameCharsOnlyMiddle.indexOf(c) === -1) {
                    cb(false, 'invalid tx data.name char '+c); return
                } else if (i === 0 || i === lowerUser.length-1) {
                    cb(false, 'invalid tx data.name char '+c+' can only be in the middle'); return
                }
            
        }

        let newAcc = await cache.findOnePromise('accounts', {name: lowerUser})
        if (newAcc)
            return cb(false, 'invalid tx data.name already exists')
        let account = await cache.findOnePromise('accounts', {name: tx.sender})
        if (dao.availableBalance(account) < eco.accountPrice(lowerUser))
            return cb(false, 'invalid tx not enough balance')
        let bwBefore = new GrowInt(account.bw, {growth:Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth)}).grow(ts)
        if (bwBefore.v < tx.data.amount)
            return cb(false, 'invalid tx not enough bw')
        if (tx.data.ref) {
            let refAcc = await cache.findOnePromise('accounts', {name: tx.data.ref})
            if (!refAcc)
                return cb(false, 'referrer does not exist')
        }
        cb(true)
    },
    execute: async (tx, ts, cb) => {
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
            earningLock: 0,
            earnings: 0,
            bw: newAccBw,
            vt: newAccVt,
            baseBwGrowth: baseBwGrowth,
            follows: [...(tx.data.ref?[tx.data.ref]:[])],
            followers: [],
            keys: [],
            proposalVotes: [],
            nftBids: {},
            verified: 0,
            created: {
                by: tx.sender,
                ts: ts
            },
            ref: tx.data.ref
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