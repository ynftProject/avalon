const cache = require("./cache")

let nft = {
    loadActiveAuctions: async () => {
        let activeNfts = await db.collection('contents').find({'ask.auction': {$exists: true}}).toArray()
        for (let n in activeNfts)
            nft.activeAuctions[activeNfts[n]._id] = activeNfts[n].ask.exp
    },
    cancelBid: async (author,link,bid) => {
        if (!bid || !bid.bidder) return
        let bidder = await cache.findOnePromise('accounts',{ name: bid.bidder })
        if (bidder.nftBids[author+'/'+link]) {
            delete bidder.nftBids[author+'/'+link]
            await cache.updateOnePromise('accounts',{ name: bid.bidder },{ $set: { nftBids: bidder.nftBids }})
        }
    },
    executeAuction: (payload,ts) => {
        return new Promise((rs) => require('./transactions/nft/orderMatch').execute(payload,ts,() => rs(true)))
    },
    runTriggers: async (ts) => {
        let currentTriggers = {}
        for (let n in nft.activeAuctions)
            if (nft.activeAuctions[n] <= ts)
                currentTriggers[n] = nft.activeAuctions[n]
        for (let n in currentTriggers) {
            let nftTrigger = await cache.findOnePromise('contents',{ _id: n })
            logr.trace('NFT auction trigger',nftTrigger)
            if (nftTrigger.ask.auction && nftTrigger.ask.auction.bidder)
                await nft.executeAuction({
                    data: {
                        author: nftTrigger.author,
                        link: nftTrigger.link,
                        target: nftTrigger.owner,
                        price: nftTrigger.ask.auction.price
                    },
                    sender: nftTrigger.ask.auction.bidder
                },ts)
            else {
                nft.removeTrigger(nftTrigger.author,nftTrigger.link)
                await cache.updateOnePromise('contents',{ _id: n },{ $set: { ask: {}}})
            }
        }
    },
    updateTrigger: (author,link,newTs) => {
        if (!nft.activeAuctions[author+'/'+link])
            nft.newAuctions[author+'/'+link] = newTs
        else if (!nft.activeAuctionsTriggerLast[author+'/'+link]) {
            nft.activeAuctionsTriggerLast[author+'/'+link] = nft.activeAuctions[author+'/'+link]
            nft.activeAuctions[author+'/'+link] = newTs
        }
    },
    removeTrigger: (author,link) => {
        nft.activeAuctionsFinalizes[author+'/'+link] = nft.activeAuctions[author+'/'+link]
        delete nft.activeAuctions[author+'/'+link]
    },
    reset: () => {
        nft.newAuctions = {}

        for (let n in nft.activeAuctionsTriggerLast)
            nft.activeAuctions[n] = nft.activeAuctionsTriggerLast[p]
        nft.activeAuctionsTriggerLast = {}

        for (let n in nft.activeAuctionsFinalizes)
            nft.activeAuctions[n] = nft.activeAuctionsFinalizes[n]
        nft.activeAuctionsFinalizes = {}
    },
    nextBlock: () => {
        for (let n in nft.newAuctions)
            nft.activeAuctions[n] = nft.newAuctions[n]
        nft.newAuctions = {}
        nft.activeAuctionsFinalizes = {}
        nft.activeAuctionsTriggerLast = {}
    },
    activeAuctions: {},
    activeAuctionsTriggerLast: {},
    activeAuctionsFinalizes: {},
    newAuctions: {}
}

module.exports = nft