const dao = require('../dao')

module.exports = {
    bsonValidate: true,
    fields: ['target','approve'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.target, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid target user to verify')
        if (!validate.integer(tx.data.approve,true,false))
            return cb(false, 'invalid approval level')
        
        let user = await cache.findOnePromise('accounts',{ name: tx.data.target })
        if (!user.verifyData || !user.verifyData.json)
            return cb(false, 'no verification data')
        if (!dao.leaderSnapshot(true).includes(tx.sender))
            return cb(false, 'verifier not in snapshot')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let user = await cache.findOnePromise('accounts',{ name: tx.data.target })
        let snapshot = dao.leaderSnapshot(true)
        let threshold = Math.ceil(snapshot.length*2/3)
        let verifies = 0
        let lvls = {}
        let isUpdate = false
        for (let i in user.verifyData.approvals) {
            if (user.verifyData.approvals[i][0] === tx.sender) {
                user.verifyData.approvals[i][1] = tx.data.approve
                isUpdate = true
            }
            if (user.verifyData.approvals[i][1] > 0 && snapshot.includes(user.verifyData.approvals[i][0])) {
                verifies++
                if (!lvls[user.verifyData.approvals[i][1]])
                    lvls[user.verifyData.approvals[i][1]] = 1
                else
                    lvls[user.verifyData.approvals[i][1]]++
            }
        }
        if (!isUpdate) {
            user.verifyData.approvals.push([tx.sender,tx.data.approve])
            if (tx.data.approve > 0) {
                verifies++
                if (!lvls[tx.data.approve])
                    lvls[tx.data.approve] = 1
                else
                    lvls[tx.data.approve]++
            }
        }
        let final = 0
        if (verifies >= threshold) {
            // median value
            let cumul = 0
            for (let l in lvls) {
                cumul += lvls[l]
                if (cumul >= Math.ceil(verifies/2)) {
                    final = l
                    break
                }
            }
        }
        if (final !== user.verified)
            user.verifyData.lastTs = ts
        let avgs = await cache.findOnePromise('state',{ _id: 2 })
        if (!user.verified && final)
            avgs.currentDistPool.accounts++
        else if (user.verified && !final)
            avgs.currentDistPool.accounts--
        await cache.updateOnePromise('state',{ _id: 2 },{ $set: { currentDistPool: avgs.currentDistPool }})
        let change = {$set:{verifyData: user.verifyData, verified: parseInt(final)}}
        await cache.updateOnePromise('accounts',{ name: tx.data.target },change)
        cb(true)
    }
}