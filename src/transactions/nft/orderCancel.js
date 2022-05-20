module.exports = {
    fields: ['author','link'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')

        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (tx.sender === nft.owner)
            await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: {ask: {}}})
        else {
            let bidder = await cache.findOnePromise('accounts',{ name: tx.sender })
            if (bidder.nftBids[tx.data.author+'/'+tx.data.link]) {
                delete bidder.nftBids[tx.data.author+'/'+tx.data.link]
                await cache.updateOnePromise('accounts',{ name: tx.sender },{ $set: { nftBids: bidder.nftBids }})
            }
        }
        cb(true)
    }
}