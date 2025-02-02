const dao = require('../../dao')
const nftAuctions = require('../../nftAuctions')
const txHistory = require('../../txHistory')

module.exports = {
    fields: ['author','link','target','price'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid author')
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid link')
        if (!validate.string(tx.data.target, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false, 'invalid target order')
        if (!validate.integer(tx.data.price, false, false))
            return cb(false, 'invalid expected price')
        
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        if (!nft)
            return cb(false, 'nft does not exist')
        if (tx.data.target === tx.sender)
            return cb(false, 'cannot fill own order')
        if (tx.sender !== nft.owner) {
            if (tx.data.target !== nft.owner || !nft.ask.price)
                return cb(false, 'order does not exist')
            else if (nft.ask.auction)
                return cb(false, 'cannot market match auctions')
            else if (nft.ask.price > tx.data.price)
                return cb(false, 'actual nft ask price is above expected price')
            else if (nft.ask.exp <= ts)
                return cb(false, 'order already expired')
            let buyer = await cache.findOnePromise('accounts',{ name: tx.sender })
            if (dao.availableBalance(buyer,ts) + nftAuctions.availableLocked(buyer.earningLock) < nft.ask.price)
                return cb(false, 'insufficient balance')
        } else {
            let buyer = await cache.findOnePromise('accounts',{ name: tx.data.target })
            if (!buyer)
                return cb(false, 'buyer does not exist')
            if (!buyer.nftBids[tx.data.author+'/'+tx.data.link])
                return cb(false, 'order does not exist')
            if (buyer.nftBids[tx.data.author+'/'+tx.data.link].price < tx.data.price)
                return cb(false, 'actual nft bid price is below expected price')
            else if (buyer.nftBids[tx.data.author+'/'+tx.data.link].exp <= ts)
                return cb(false, 'order already expired')
        }
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let nft = await cache.findOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link })
        let price = 0
        let fee = 0
        let sellerProceeds = 0
        let earningLockSpent = 0
        let earningLockPremium = 0
        let royalty = 0
        let buyerName = ''
        let side = ''
        if (tx.sender !== nft.owner) {
            // market buy
            side = 'buy'
            price = nft.ask.price
            if (nft.ask.auction && nft.ask.auction.price)
                price = nft.ask.auction.price
            fee = Math.ceil(price*config.nftSaleFee/10000)
            sellerProceeds = price - fee
            buyerName = tx.sender
            let buyer = await cache.findOnePromise('accounts',{ name: buyerName })
            delete buyer.nftBids[tx.data.author+'/'+tx.data.link]
            let changes = { $inc: { balance: -price }, $set: { nftBids: buyer.nftBids }}
            if (nftAuctions.availableLocked(buyer.earningLock)) {
                let maxLockSpend = Math.ceil(price*config.earningLockNftPremium)
                earningLockSpent = buyer.earningLock < maxLockSpend ? buyer.earningLock : maxLockSpend
                earningLockPremium = Math.max(0,Math.round(earningLockSpent*(1-(1/config.earningLockNftPremium))))
                changes.$inc.balance -= earningLockPremium
                changes.$inc.earningLock = -earningLockSpent
                logr.econ('Lock spend: '+earningLockSpent+'  Premium: '+earningLockPremium)
            }
            await cache.updateOnePromise('accounts',{ name: buyerName },changes)
            await transaction.updateIntsAndNodeApprPromise(buyer,ts,-price-earningLockPremium)
        } else {
            // market sell
            side = 'sell'
            buyerName = tx.data.target
            let buyer = await cache.findOnePromise('accounts',{ name: buyerName })
            price = buyer.nftBids[tx.data.author+'/'+tx.data.link].price
            fee = Math.ceil(price*config.nftSaleFee/10000)
            sellerProceeds = price - fee
            delete buyer.nftBids[tx.data.author+'/'+tx.data.link]
            await cache.updateOnePromise('accounts',{ name: buyerName },{ $inc: { balance: -price }, $set: { nftBids: buyer.nftBids }})
            await transaction.updateIntsAndNodeApprPromise(buyer,ts,-price)
        }
        
        // author royalty
        if (nft.owner !== nft.author) {
            royalty = Math.ceil(price*config.nftSaleRoyalty/10000)
            sellerProceeds -= royalty
            let author = await cache.findOnePromise('accounts',{ name: nft.author })
            await cache.updateOnePromise('accounts',{ name: nft.author },{ $inc: { balance: royalty }})
            await transaction.updateIntsAndNodeApprPromise(author,ts,royalty)
        }

        // credit proceeds to previous owner
        let seller = await cache.findOnePromise('accounts',{ name: nft.owner })
        await cache.updateOnePromise('accounts',{ name: nft.owner },{ $inc: { balance: sellerProceeds }})
        await transaction.updateIntsAndNodeApprPromise(seller,ts,sellerProceeds)

        // nft sale fee
        let feeAccount = await cache.findOnePromise('accounts',{ name: config.masterName })
        await cache.updateOnePromise('accounts',{ name: config.masterName },{ $inc: { balance: fee+earningLockPremium }})
        await transaction.updateIntsAndNodeApprPromise(feeAccount,ts,fee+earningLockPremium)

        // remove nft ask orders and auctions
        if (nft.ask && nft.ask.auction) {
            nftAuctions.removeTrigger(tx.data.author,tx.data.link)
            if (nft.ask.auction.bidder)
                nftAuctions.cancelBid(tx.data.author,tx.data.link,nft.ask.auction)
        }
        await cache.updateOnePromise('contents',{ _id: tx.data.author+'/'+tx.data.link },{ $set: { ask: {} }})

        // log event
        txHistory.logEvent(tx.hash, {
            price, fee, sellerProceeds, earningLockSpent, earningLockPremium, royalty, side
        })

        // transfer nft
        require('./transfer').execute({
            data: {
                author: tx.data.author,
                link: tx.data.link,
                receiver: buyerName
            },
            sender: nft.owner
        },ts,cb)
    }
}