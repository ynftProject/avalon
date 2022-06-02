module.exports = {
    fields: ['symbol','amount','receiver'],
    validate: async (tx, ts, legitUser, cb) => {
        // for now, GC and YNFT-GC LP are the only tokens
        // only GC mints are transactable
        if (typeof tx.data.symbol !== 'string' || tx.data.symbol !== 'GC')
            return cb(false, 'invalid symbol')
        
        if (!validate.integer(tx.data.amount,false,false))
            return cb(false, 'invalid token amount')
        
        if (!validate.string(tx.data.receiver,config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid token mint receiver')

        // GC token controlled by master account
        if (tx.sender !== config.masterName)
            return cb(false, 'only master account can mint token')

        let receiver = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        if (!receiver)
            return cb(false, 'receiver does not exist')

        cb(true)
    },
    execute: (tx, ts, cb) => {
        require('./transfer').execute({
            data: tx.data,
            sender: config.burnAccount
        },ts,cb)
    }
}