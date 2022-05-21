module.exports = {
    bsonValidate: true,
    fields: ['json'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.json(tx.data.json, config.jsonMaxBytes))
            return cb(false, 'invalid verification data json')
        
        let user = await cache.findOnePromise('accounts',{ name: tx.sender })
        if (user.verified)
            return cb(false, 'user already verified')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        await cache.updateOnePromise('accounts',{ name: tx.sender },{$set: { verifyData: {
            json: tx.data.json,
            approvals: [],
            requestTs: ts
        }}})
        cb(true)
    }
}