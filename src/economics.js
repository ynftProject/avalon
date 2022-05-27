// List of potential community-breaking abuses:
// 1- Multi accounts voting (cartoons)
// 2- Bid-bots (selling votes)
// 3- Self-voting whales (haejin)
// 4- Curation trails (bots auto-voting tags or authors)

// What we decided:
// 1- Flat curation
// 2- Money goes into content, claim button stops curation rewards
// 3- People can claim curation rewards after X days. Time lock to allow downvotes to take away rewards
// 4- Rentability curve: based on time since the vote was cast. Starts at X%, goes up to 100% at optimal voting time, then goes down to Y% at the payout time and after.
// 5- Downvotes print the same DTC amount as an upvote would. But they also reduce upvote rewards by X% of that amount
// 6- Use weighted averages for rewardPool data to smooth it out

let eco = {
    startRewardPool: null,
    lastRewardPool: null,
    currentBlock: {
        dist: 0,
        burn: 0,
        votes: 0
    },
    history: [],
    nextBlock: () => {
        eco.currentBlock.dist = 0
        eco.currentBlock.burn = 0
        eco.currentBlock.votes = 0
        if (eco.startRewardPool)
            eco.lastRewardPool = eco.startRewardPool
        eco.startRewardPool = null
    },
    loadHistory: () => {
        eco.history = []
        let lastCBurn = 0
        let lastCDist = 0
        let firstBlockIndex = chain.recentBlocks.length - config.ecoBlocks
        if (firstBlockIndex < 0) firstBlockIndex = 0
        for (let i = firstBlockIndex; i < chain.recentBlocks.length; i++) {
            const block = chain.recentBlocks[i]
            if (block.burn)
                lastCBurn += block.burn
            if (block.dist)
                lastCDist += block.dist

            eco.history.push({_id: block._id, votes: block.vp || 0})
        }

        eco.history[eco.history.length-1].cDist = eco.round(lastCDist)
        eco.history[eco.history.length-1].cBurn = eco.round(lastCBurn)
    },
    appendHistory: (nextBlock) => {
        // nextBlock should yet to be added to recentBlocks
        let lastIdx = chain.recentBlocks.length-config.ecoBlocks
        let oldDist = lastIdx >= 0 ? chain.recentBlocks[lastIdx].dist || 0 : 0
        let oldBurn = lastIdx >= 0 ? chain.recentBlocks[lastIdx].burn || 0 : 0
        eco.history.push({
            _id: nextBlock._id,
            votes: nextBlock.vp || 0,
            cDist: eco.round(eco.history[eco.history.length-1].cDist - oldDist + (nextBlock.dist || 0)),
            cBurn: eco.round(eco.history[eco.history.length-1].cBurn - oldBurn + (nextBlock.burn || 0))
        })
    },
    cleanHistory: () => {
        if (config.ecoBlocksIncreasesSoon) return
        let extraBlocks = eco.history.length - config.ecoBlocks
        while (extraBlocks > 0) {
            eco.history.shift()
            extraBlocks--
        }
    },
    rewardPool: () => {
        let theoricalPool = config.rewardPoolAmount
        let burned = 0
        let distributed = 0
        let votes = 0
        if (!eco.startRewardPool) {
            distributed = eco.history[eco.history.length-1].cDist
            burned = eco.history[eco.history.length-1].cBurn
            let firstBlockIndex = eco.history.length - config.ecoBlocks
            if (firstBlockIndex < 0) firstBlockIndex = 0
            let weight = 1
            for (let i = firstBlockIndex; i < eco.history.length; i++) {
                votes += eco.history[i].votes*weight
                weight++
            }

            // weighted average for votes
            votes /= (weight+1)/2

            eco.startRewardPool = {
                burn: burned,
                dist: distributed,
                votes: votes,
                theo: theoricalPool,
                avail: theoricalPool - distributed
            }
        } else {
            burned = eco.startRewardPool.burn
            distributed = eco.startRewardPool.dist
            votes = eco.startRewardPool.votes
        }
        

        let avail = theoricalPool - distributed - eco.currentBlock.dist
        if (avail < 0) avail = 0
        burned += eco.currentBlock.burn
        distributed += eco.currentBlock.dist
        votes += eco.currentBlock.votes

        avail = eco.round(avail)
        burned = eco.round(burned)
        distributed = eco.round(distributed)
        votes = eco.round(votes)
        return {
            theo: theoricalPool,
            burn: burned,
            dist: distributed,
            votes: votes,
            avail: avail
        }
    },
    accountPrice: (username) => {
        let price = config.accountPriceMin
        let extra = config.accountPriceBase - config.accountPriceMin
        let mult = Math.pow(config.accountPriceChars / username.length, config.accountPriceCharMult)
        price += Math.round(extra*mult)
        return price
    },
    curation: async (author, link, currentVote) => {
        let content = await cache.findOnePromise('contents',{_id:author+'/'+link})
        let thNewCoins = currentVote.vt < 0 ? 0 : eco.print(currentVote.vt)
        let shares = {
            author: config.ecoAuthorReward,
            voter: config.ecoCurationReward,
            fee: config.ecoMasterFee,
            authorReward: 0,
            voterReward: 0,
            authorExceeding: 0,
            voterExceeding: 0,
            feeReward: 0,
        }

        if (currentVote.vt > 0) {
            let earningLimit = await eco.earningLimit()
            let ownership = await cache.findOnePromise('nftOwnership',{_id:author+'/'+currentVote.u})
            if (ownership && ownership.count > 0 && ownership.since < content.ts) {
                shares.author = config.ecoAuthorRewardOwning
                shares.voter = config.ecoCurationRewardOwning,
                shares.fee = config.ecoMasterFeeOwning
            }
            logr.econ('Earning Limits',earningLimit)
            shares.authorReward = Math.floor(thNewCoins*shares.author/10000)
            shares.voterReward = Math.floor(thNewCoins*shares.voter/10000)
            shares.feeReward = Math.floor(thNewCoins*shares.fee/10000)
            if (shares.authorReward) {
                let authorAcc = await cache.findOnePromise('accounts',{name: author})
                logr.econ('Author earnings',authorAcc.earnings)
                if (authorAcc.earnings+shares.authorReward > earningLimit.rpel)
                    shares.authorReward = Math.max(0,earningLimit.rpel - authorAcc.earnings)
                if (authorAcc.earnings+shares.authorReward > earningLimit.pel)
                    shares.authorExceeding = Math.min(authorAcc.earnings+shares.authorReward-earningLimit.pel,shares.authorReward)
                if (shares.authorReward) {
                    await cache.updateOnePromise('accounts',{name: author},{$inc:{balance: shares.authorReward-shares.authorExceeding, earningLock: shares.authorReward-shares.authorExceeding, earnings: shares.authorReward}})
                    await transaction.updateIntsAndNodeApprPromise(authorAcc,currentVote.ts,shares.authorReward-shares.authorExceeding)
                }
            }
            if (shares.voterReward) {
                let voterAcc = await cache.findOnePromise('accounts',{name: currentVote.u})
                logr.econ('Voter earnings',voterAcc.earnings)
                if (voterAcc.earnings+shares.voterReward > earningLimit.rpel)
                    shares.voterReward = Math.max(0,earningLimit.rpel - voterAcc.earnings)
                if (voterAcc.earnings+shares.voterReward > earningLimit.pel)
                    shares.voterExceeding = Math.min(voterAcc.earnings+shares.voterReward-earningLimit.pel,shares.voterReward)
                if (shares.voterReward) {
                    await cache.updateOnePromise('accounts',{name: currentVote.u},{$inc:{balance: shares.voterReward-shares.voterExceeding, earnings: shares.voterReward}})
                    await transaction.updateIntsAndNodeApprPromise(voterAcc,currentVote.ts,shares.voterReward-shares.voterExceeding)
                }
            }
            if (!shares.authorReward && !shares.voterReward)
                shares.feeReward = 0
            if (shares.feeReward) {
                let feeAcc = await cache.findOnePromise('accounts',{name: config.masterName})
                await cache.updateOnePromise('accounts',{name: config.masterName},{$inc:{balance: shares.feeReward}})
                await transaction.updateIntsAndNodeApprPromise(feeAcc,currentVote.ts,shares.feeReward)
            }
            if (shares.authorReward || shares.voterReward || shares.authorExceeding || shares.voterExceeding) {
                let avgs = await cache.findOnePromise('state',{_id: 2})
                avgs.earning.total = (BigInt(avgs.earning.total)+BigInt(shares.authorReward)+BigInt(shares.voterReward)).toString()
                avgs.currentDistPool.total += shares.authorExceeding+shares.voterExceeding
                await cache.updateOnePromise('state',{_id: 2},{$set:{earning: avgs.earning, currentDistPool: avgs.currentDistPool}})
            }
            currentVote.authorDist = shares.authorReward
            currentVote.voterDist = shares.voterReward
            currentVote.feeDist = shares.feeReward
            if (shares.authorExceeding) currentVote.authorExceeding = shares.authorExceeding
            if (shares.voterExceeding) currentVote.voterExceeding = shares.voterExceeding
            logr.econ('shares',shares)
        }
        let newCoins = shares.authorReward+shares.voterReward+shares.feeReward
        logr.econ(newCoins + ' dist from the vote')

        // add dist/burn/votes to currentBlock eco stats
        eco.currentBlock.dist += newCoins
        eco.currentBlock.dist = eco.round(eco.currentBlock.dist)
        eco.currentBlock.votes += currentVote.vt

        // updating the content
        // increase the dist amount for display
        // and update the votes array
        await cache.updateOnePromise('contents', {_id: author+'/'+link}, {
            $inc: {dist: newCoins},
            $push: {votes: currentVote}
        })
        return newCoins
    },
    print: (vt) => {
        // loads current reward pool data
        // and converts VP to DTC based on reward pool stats
        let stats = eco.rewardPool()
        // if reward pool is empty, print nothing
        // (can only happen if witnesses freeze distribution in settings)
        if (stats.avail === 0)
            return 0

        let thNewCoins = 0

        // if theres no vote in reward pool stats, we print 1 coin (minimum)
        if (stats.votes === 0)
            thNewCoins = 1
        // otherwise we proportionally reduce based on recent votes weight
        // and how much is available for printing
        else
            thNewCoins = stats.avail * Math.abs((vt) / stats.votes)

        // rounding down
        thNewCoins = eco.floor(thNewCoins)
        
        // and making sure one person cant empty the whole pool when network has been inactive
        // e.g. when stats.votes close to 0
        // then vote value will be capped to rewardPoolMaxShare %
        if (thNewCoins > Math.floor(stats.avail*config.rewardPoolMaxShare))
            thNewCoins = Math.floor(stats.avail*config.rewardPoolMaxShare)

        logr.econ('PRINT:'+vt+' VT => '+thNewCoins+' dist', stats.avail)
        return thNewCoins
    },
    incrementAccount: async () => {
        let avgs = await cache.findOnePromise('state',{_id: 2})
        avgs.tvap.count++
        avgs.earning.count++
        await cache.updateOnePromise('state',{_id: 2},{$set:{tvap: avgs.tvap, earning: avgs.earning}})
    },
    earningLimit: async () => {
        let avgs = await cache.findOnePromise('state',{_id: 2})
        return {
            pel: Math.max(config.earningLimitFloor, Math.floor(config.earningLimitFactorPEL*Number(BigInt(avgs.earning.total)/BigInt(avgs.earning.count)))),
            rpel: Math.max(config.earningLimitFloor, Math.floor(config.earningLimitFactorRPEL*Number(BigInt(avgs.earning.total)/BigInt(avgs.earning.count)))),
        }
    },
    round: (val = 0) => Math.round(val*Math.pow(10,config.ecoClaimPrecision))/Math.pow(10,config.ecoClaimPrecision),
    floor: (val = 0) => Math.floor(val*Math.pow(10,config.ecoClaimPrecision))/Math.pow(10,config.ecoClaimPrecision)
} 

module.exports = eco