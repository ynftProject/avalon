const dao = require('../dao')

module.exports = {
    bsonValidate: true,
    fields: ['receiver', 'amount', 'memo'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        }
        if (!validate.string(tx.data.memo, config.memoMaxLength)) {
            cb(false, 'invalid tx data.memo'); return
        }
        if (tx.data.receiver === tx.sender) {
            cb(false, 'invalid tx cannot send to self'); return
        }

        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (err) throw err
            if (dao.availableBalance(account,ts) < tx.data.amount)
                return cb(false, 'invalid tx not enough balance')

            cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                if (err) throw err
                if (!account) cb(false, 'invalid tx receiver does not exist')
                else cb(true)
            })
        })
    },
    execute: async (tx, ts, cb) => {
        // remove funds from sender
        await cache.updateOnePromise('accounts', 
            {name: tx.sender},
            {$inc: {balance: -tx.data.amount}})
        let accSender = await cache.findOnePromise('accounts', {name: tx.sender})
        accSender.balance += tx.data.amount
        await transaction.updateIntsAndNodeApprPromise(accSender, ts, -tx.data.amount)
        if (tx.data.receiver === config.burnAccount)
            return cb(true,0,tx.data.amount)

        // add funds to receiver
        await cache.updateOnePromise('accounts', 
            {name: tx.data.receiver},
            {$inc: {balance: tx.data.amount}})
        let accReceiver = await cache.findOnePromise('accounts', {name: tx.data.receiver})
        accReceiver.balance -= tx.data.amount
        await transaction.updateIntsAndNodeApprPromise(accReceiver, ts, tx.data.amount)

        cb(true)
    }
}