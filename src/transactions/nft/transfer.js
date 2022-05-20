module.exports = {
    bsonValidate: true,
    fields: ['author','link','receiver','memo'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid receiver')
        if (!validate.string(tx.data.memo, config.memoMaxLength))
            return cb(false, 'invalid memo')

        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        if (nft.owner !== tx.sender)
            return cb(false, 'sender does not own the nft')
        if (nft.ask && nft.ask.price && nft.ask.exp > ts)
            return cb(false, 'cannot transfer nft with existing sell order')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: { owner: tx.data.receiver }})
        if (tx.data.author !== tx.data.receiver) {
            let newOwner = await cache.findOnePromise('nftOwnership',{ _id: tx.data.author+'/'+tx.data.receiver })
            if (newOwner) {
                let newOwnerUpdate = {$set: {}, $inc: { count: 1 }}
                if (newOwner.count === 0)
                    newOwnerUpdate.$set.since = ts
                await cache.updateOnePromise('nftOwnership', { _id: tx.data.author+'/'+tx.data.receiver },newOwnerUpdate)
            } else
                await cache.insertOnePromise('nftOwnership', {
                    _id: tx.data.author+'/'+tx.data.receiver,
                    owner: tx.data.receiver,
                    author: tx.data.author,
                    since: ts,
                    count: 1
                })
        }
        if (tx.data.author !== tx.sender)
            await cache.updateOnePromise('nftOwnership', { _id: tx.data.author+'/'+tx.sender },{ $inc: { count: -1 }})
        
        // clear bids for the nft on receipient
        let receiver = await cache.findOnePromise('accounts',{ name: tx.data.receiver })
        if (receiver.nftBids[tx.data.author+'/'+tx.data.link]) {
            delete receiver.nftBids[tx.data.author+'/'+tx.data.link]
            await cache.updateOnePromise('accounts', { name: tx.data.receiver },{ $set: { nftBids: receiver.nftBids }})
        }
        cb(true)
    }
}