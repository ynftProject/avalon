const dao = require('../../dao')
const nftAuctions = require('../../nftAuctions')

module.exports = {
    fields: ['author','link','price'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')
        if (!validate.integer(tx.data.price, false, false, Number.MAX_SAFE_INTEGER, config.nftFloorPrice))
            return cb(false, 'nft bid price must be an integer greater than '+config.nftFloorPrice)

        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        if (tx.sender === nft.owner)
            return cb(false, 'cannot place bid on own nft auction')
        else if (!nft.ask || !nft.ask.auction)
            return cb(false, 'there is no auction running for this nft')
        else if (nft.ask.auction.price && tx.data.price <= nft.ask.auction.price)
            return cb(false, 'bid price is below current highest bid of '+nft.ask.auction.price)
        else if (!nft.ask.auction.price && tx.data.price <= nft.ask.price)
            return cb(false, 'cannot bid below minimum bid price')

        let bidder = await cache.findOnePromise('accounts',{ name: tx.sender })
        if (dao.availableBalance(bidder,ts) < tx.data.price)
            return cb(false, 'insufficient balance to place nft bid order')
        if (!bidder.nftBids[tx.data.author+'/'+tx.data.link] && Object.keys(bidder.nftBids).length >= config.nftMaxBids)
            return cb(false, 'cannot bid more than '+config.nftMaxBids+' nfts at a time')
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        let order = {
            price: tx.data.price,
            exp: Infinity,
            auction: true
        }
        let bidder = await cache.findOnePromise('accounts',{ name: tx.sender })
        bidder.nftBids[tx.data.author+'/'+tx.data.link] = order
        await cache.updateOnePromise('accounts',{ name: tx.sender },{ $set: { nftBids: bidder.nftBids }})

        if (nft.ask.auction.bidder)
            await nftAuctions.cancelBid(tx.data.author,tx.data.link,nft.ask.auction)
        nft.ask.auction = {
            bidder: tx.sender,
            price: tx.data.price
        }
        await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: { ask: nft.ask }})
        cb(true)
    }
}