const nftAuctions = require('../../nftAuctions')

module.exports = {
    fields: ['author','link','price','end'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')
        if (!validate.integer(tx.data.price, false, false, Number.MAX_SAFE_INTEGER, config.nftFloorPrice))
            return cb(false, 'nft auction starting price must be an integer greater than '+config.nftFloorPrice)
        if (!validate.integer(tx.data.end, false, false, ts+(config.nftMaxExpSeconds*1000), ts))
            return cb(false, 'invalid auction end timestamp')

        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        if (tx.sender !== nft.owner)
            return cb(false, 'cannot auction an nft that isn\'t yours')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        nft.ask.price = tx.data.price
        nft.ask.exp = tx.data.end
        if (!nft.ask.auction)
            nft.ask.auction = {}
        await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: { ask: nft.ask }})
        nftAuctions.updateTrigger(tx.data.author,tx.data.link,tx.data.end)
        cb(true)
    }
}