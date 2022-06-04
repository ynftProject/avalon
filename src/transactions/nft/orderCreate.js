const dao = require('../../dao')
const txHistory = require('../../txHistory')

module.exports = {
    fields: ['author','link','price','exp'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')
        if (!validate.integer(tx.data.price, false, false, Number.MAX_SAFE_INTEGER, config.nftFloorPrice))
            return cb(false, 'nft order price must be an integer greater than '+config.nftFloorPrice)
        if (!validate.integer(tx.data.exp, false, false, ts+(config.nftMaxExpSeconds*1000), ts))
            return cb(false, 'invalid order expiration')

        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        if (tx.sender !== nft.owner) {
            let bidder = await cache.findOnePromise('accounts',{ name: tx.sender })
            if (dao.availableBalance(bidder,ts) < tx.data.price)
                return cb(false, 'insufficient balance to place nft bid order')
            if (!bidder.nftBids[tx.data.author+'/'+tx.data.link] && Object.keys(bidder.nftBids).length >= config.nftMaxBids)
                return cb(false, 'cannot bid more than '+config.nftMaxBids+' nfts at a time')
        } else if (nft.ask && nft.ask.auction)
            return cb(false, 'cannot create ask order with already active auction')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        let order = {
            price: tx.data.price,
            exp: tx.data.exp
        }
        let side = ''
        if (tx.sender !== nft.owner) {
            let bidder = await cache.findOnePromise('accounts',{ name: tx.sender })
            bidder.nftBids[tx.data.author+'/'+tx.data.link] = order
            await cache.updateOnePromise('accounts',{ name: tx.sender },{ $set: { nftBids: bidder.nftBids }})
            side = 'buy'
        } else {
            await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: { ask: order }})
            side = 'sell'
        }
        txHistory.logEvent(tx.hash,{side})
        cb(true)
    }
}