let dao = {
    availableBalance: (account,ts) => {
        if (!account.voteLock)
            return account.balance
        let newLock = 0
        for (let v in account.proposalVotes)
            if (account.proposalVotes[v].end > ts && account.proposalVotes[v].amount - account.proposalVotes[v].bonus > newLock)
                newLock = account.proposalVotes[v].amount - account.proposalVotes[v].bonus
        return account.balance - newLock
    },
    fundRequestCreationFee: (requestedFund = 1) => {
        let baseFee = config.fundRequestBaseFee
        let subseqAmounts = requestedFund-config.fundRequestSubStart
        if (subseqAmounts <= 0)
            return baseFee
        let subseqFee = Math.ceil((subseqAmounts*config.fundRequestSubFee)/config.fundRequestSubMult)
        return baseFee+subseqFee
    },
    getChainUpdateStatus: (proposal,ts) => {
        if (proposal.votingEnds > ts)
            return dao.chainUpdateStatus.votingActive
        else if (proposal.votingEnds <= ts && (proposal.approvals < config.daoVotingThreshold || proposal.approvals < proposal.disapprovals))
            return dao.chainUpdateStatus.votingRejected
        else if (proposal.executionTs > ts)
            return dao.chainUpdateStatus.votingSuccess
        else
            return dao.chainUpdateStatus.executed
    },
    getFundRequestStatus: (proposal,ts) => {
        if (proposal.votingEnds > ts)
            return dao.fundRequestStatus.votingActive
        else if (proposal.votingEnds <= ts && (proposal.approvals < config.daoVotingThreshold || proposal.approvals < proposal.disapprovals))
            return dao.fundRequestStatus.votingRejected
        else if (proposal.raised !== proposal.requested)
            if (proposal.fundingEnds > ts)
                return dao.fundRequestStatus.fundingActive
            else
                return dao.fundRequestStatus.fundingFailed
        else if (!proposal.work)
            if (proposal.deadline < ts)
                return dao.fundRequestStatus.proposalExpired
            else
                return dao.fundRequestStatus.fundingSuccess
        else if (!proposal.paid)
            if (!proposal.reviewDeadline)
                return dao.fundRequestStatus.revisionRequired
            else if (proposal.reviewDeadline > ts)
                return dao.fundRequestStatus.reviewInProgress
        else
            return dao.fundRequestStatus.proposalComplete
    },
    getFundRequestReviewThreshold: (proposal) => {
        let snapshotLength = proposal.leaderSnapshot.length
        return Math.ceil((snapshotLength*2)/3)
    },
    refundContributors: async (proposal,ts) => {
        if (!proposal.contrib)
            return
        for (let c in proposal.contrib) {
            let refundee = cache.findOnePromise('accounts',{ name: c })
            await cache.updateOnePromise('accounts',{ name: c },{ $inc: { balance: proposal.contrib[c] }})
            await transaction.updateIntsAndNodeApprPromise(refundee,ts,proposal.contrib[c])
        }
    },
    refundProposalFee: async (proposal,ts) => {
        if (!proposal.fee)
            return
        let refundee = cache.findOnePromise('accounts',{ name: proposal.creator })
        await cache.updateOnePromise('accounts',{ name: proposal.creator },{ $inc: { balance: proposal.fee }})
        await transaction.updateIntsAndNodeApprPromise(refundee,ts,proposal.fee)
    },
    disburseFundRequest: async (receiver,amount,ts) => {
        let beneficiary = await cache.findOnePromise('accounts',{ name: receiver })
        await cache.updateOnePromise('accounts',{ name: receiver },{ $inc: { balance: amount }})
        await transaction.updateIntsAndNodeApprPromise(beneficiary,ts,amount)
    },
    leaderSnapshot: () => {
        let lastLeaders = {}
        for (let b = 1; b <= config.daoLeaderSnapshotBlocks; b++)
            if (chain.recentBlocks.length-b >= 0)
                lastLeaders[chain.recentBlocks[chain.recentBlocks.length-b].miner] = 1
        return Object.keys(lastLeaders)
    },
    runTriggers: async (ts) => {
        let feeBurn = 0
        let currentTriggers = {}
        for (let p in dao.activeProposalIDs)
            if (dao.activeProposalIDs[p] <= ts)
                currentTriggers[p] = dao.activeProposalIDs[p]
        for (let p in currentTriggers) {
            let proposal = await cache.findOnePromise('proposals',{ _id: p })
            if (proposal && proposal.type === dao.governanceTypes.fundRequest) {
                let newStatus = dao.getFundRequestStatus(proposal,ts)
                let updateOp = { $set: { status: newStatus }}
                logr.trace('DAO trigger',newStatus,proposal)
                if (newStatus === dao.fundRequestStatus.votingRejected) {
                    feeBurn += proposal.fee
                    dao.finalizeProposal(p)
                } else if (newStatus === dao.fundRequestStatus.fundingFailed || newStatus === dao.fundRequestStatus.proposalExpired) {
                    feeBurn += proposal.fee
                    await dao.refundContributors(proposal,ts)
                    dao.finalizeProposal(p)
                } else if (newStatus === dao.fundRequestStatus.fundingActive)
                    dao.updateProposalTrigger(p,proposal.fundingEnds)
                else if (newStatus === dao.fundRequestStatus.fundingSuccess)
                    dao.updateProposalTrigger(p,proposal.deadline)
                else if (newStatus === dao.fundRequestStatus.proposalComplete) {
                    await dao.disburseFundRequest(proposal.receiver,proposal.raised+proposal.fee,ts)
                    updateOp.$set.paid = ts
                    dao.finalizeProposal(p)
                }

                await cache.updateOnePromise('proposals',{ _id: p },updateOp)
            } else if (proposal && proposal.type === dao.governanceTypes.chainUpdate) {
                let newStatus = dao.getChainUpdateStatus(proposal,ts)
                let updateOp = { $set: { status: newStatus }}
                logr.trace('DAO trigger',newStatus,proposal)
                if (newStatus === dao.chainUpdateStatus.votingRejected) {
                    feeBurn += proposal.fee
                    dao.finalizeProposal(p)
                } else if (newStatus === dao.chainUpdateStatus.votingSuccess) {
                    let executionTs = proposal.votingEnds+(config.chainUpdateGracePeriodSeconds*1000)
                    updateOp.$set.executionTs = executionTs
                    dao.updateProposalTrigger(p,executionTs)
                } else if (newStatus === dao.chainUpdateStatus.executed) {
                    await dao.refundProposalFee(proposal,ts)
                    dao.finalizeProposal(p)
                }

                await cache.updateOnePromise('proposals',{ _id: p },updateOp)
            }
        }
        return feeBurn
    },
    updateProposalTrigger: (id,newTs) => {
        if (!dao.activeProposalTriggerLast[id])
            dao.activeProposalTriggerLast[id] = dao.activeProposalIDs[id]
        dao.activeProposalIDs[id] = newTs
    },
    finalizeProposal: (id) => {
        dao.activeProposalFinalizes[id] = dao.activeProposalIDs[id]
        delete dao.activeProposalIDs[id]
    },
    loadActiveFundRequests: async () => {
        let activeRequests = await db.collection('proposals').find({$and: [
            {type:1},
            {$or: [
                {status: 0},
                {status: 2},
                {status: 3},
                {status: 5},
            ]}
        ]}).toArray()
        for (let i in activeRequests) {
            cache.proposals[activeRequests[i]._id] = activeRequests[i]
            switch (activeRequests[i].status) {
                case dao.fundRequestStatus.votingActive:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].votingEnds
                    break
                case dao.fundRequestStatus.fundingActive:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].fundingEnds
                    break
                case dao.fundRequestStatus.fundingSuccess:
                case dao.fundRequestStatus.revisionRequired:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].deadline
                    break
                case dao.fundRequestStatus.reviewInProgress:
                    dao.activeProposalIDs[activeRequests[i]._id] = activeRequests[i].reviewDeadline
                    break
            }
        }
    },
    loadID: async () => {
        let latestProposal = await db.collection('proposals').find({},{sort: {_id:-1},limit:1}).toArray()
        if (latestProposal && latestProposal.length > 0) {
            dao.lastID = latestProposal[0]._id
            dao.nextID = dao.lastID+1
        }
    },
    incrementID: () => dao.nextID++,
    resetID: () => {
        // resrt last id
        dao.nextID = dao.lastID+1

        // reset proposal triggers
        for (let p in dao.activeProposalTriggerLast)
            dao.activeProposalIDs[p] = dao.activeProposalTriggerLast[p]
        dao.activeProposalTriggerLast = {}

        // reset proposal finalizes
        for (let p in dao.activeProposalFinalizes)
            dao.activeProposalIDs[p] = dao.activeProposalFinalizes[p]
        dao.activeProposalFinalizes = {}
    },
    nextBlock: async (ts) => {
        // update ids for new proposals
        if (dao.nextID - dao.lastID >= 2)
            for (let i = dao.lastID+1; i < dao.nextID; i++)
                dao.activeProposalIDs[i] = ts+(config.daoVotingPeriodSeconds*1000)
        dao.lastID = dao.nextID-1

        // clear old triggers and finalizes
        dao.activeProposalTriggerLast = {}
        dao.activeProposalFinalizes = {}
    },
    nextID: 1,
    lastID: 0,
    activeProposalIDs: {},
    activeProposalTriggerLast: {},
    activeProposalFinalizes: {},
    governanceTypes: {
        fundRequest: 1,
        chainUpdate: 2
    },
    fundRequestStatus: {
        votingActive: 0,
        votingRejected: 1,
        fundingActive: 2,
        fundingSuccess: 3,
        fundingFailed: 4,
        reviewInProgress: 5,
        proposalComplete: 6,
        proposalExpired: 7,
        revisionRequired: 8
    },
    chainUpdateStatus: {
        votingActive: 0,
        votingRejected: 1,
        votingSuccess: 2,
        executed: 3
    }
}

module.exports = dao

/*
Fund request status transitions:

votingActive to votingRejected -> trigger
votingActive to fundingActice -> trigger
fundingActive to fundingSuccess -> tx (proposal.raised === proposal.requested)
functingActive to fundingFailed -> trigger
fundingSuccess to reviewInProgress -> tx (submit work)
fundingSuccess to proposalExpired -> trigger
reviewInProgress to proposalComplete -> trigger or tx

Chain update status transitions:

votingActive to votingRejected -> trigger
votingActive to votingSuccess -> trigger
votingSuccess to executed -> trigger
*/