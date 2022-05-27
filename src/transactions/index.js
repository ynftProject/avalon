const { performance } = require('perf_hooks')
const WARN_SLOW_VALID = process.env.WARN_SLOW_VALID || 5
const WARN_SLOW_EXEC = process.env.WARN_SLOW_EXEC || 5

const transactions = [
    require('./newAccount.js'),
    require('./approveNode.js'),
    require('./disaproveNode.js'),
    require('./transfer.js'),
    require('./comment.js'),
    require('./vote.js'),
    require('./userJson.js'),
    require('./follow.js'),
    require('./unfollow.js'),
    require('./newKey.js'),
    require('./removeKey.js'),
    require('./changePassword.js'),
    require('./transferBw.js'),
    require('./limitVt.js'),
    require('./enableNode.js'),
    require('./nft/transfer.js'),
    require('./nft/orderCreate.js'),
    require('./nft/orderCancel.js'),
    require('./nft/orderMatch.js'),
    null,
    null,
    null,
    require('./setSignThreshold.js'),
    require('./setPasswordWeight.js'),
    require('./unsetSignThreshold.js'),
    require('./playlistJson.js'),
    require('./playlistPush.js'),
    require('./playlistPop.js'),
    require('./commentEdit.js'),
    require('./accountAuthorize.js'),
    require('./accountRevoke.js'),
    require('./dao/fundRequestCreate.js'),
    require('./dao/fundRequestContrib'),
    require('./dao/fundRequestWork'),
    require('./dao/fundRequestWorkReview.js'),
    require('./dao/proposalVote.js'),
    require('./dao/proposalEdit.js'),
    require('./dao/chainUpdateCreate.js'),
    require('./dao/mdQueue.js'),
    require('./dao/mdSign.js'),
    require('./nft/auctionCreate.js'),
    require('./nft/auctionBid.js'),
    require('./verifyRequest.js'),
    require('./verifyResponse.js')
]

module.exports = {
    Types: {
        NEW_ACCOUNT: 0,
        APPROVE_NODE_OWNER: 1,
        DISAPROVE_NODE_OWNER: 2,
        TRANSFER: 3,
        COMMENT: 4,
        VOTE: 5,
        USER_JSON: 6,
        FOLLOW: 7,
        UNFOLLOW: 8,
        NEW_KEY: 9,
        REMOVE_KEY: 10,
        CHANGE_PASSWORD: 11,
        TRANSFER_BW: 12,
        LIMIT_VT: 13,
        ENABLE_NODE: 14,
        TRANSFER_NFT: 15,
        NFT_ORDER_CREATE: 16,
        NFT_ORDER_CANCEL: 17,
        NFT_ORDER_MATCH: 18,
        SET_SIG_THRESHOLD: 22,
        SET_PASSWORD_WEIGHT: 23,
        UNSET_SIG_THRESHOLD: 24,
        PLAYLIST_JSON: 25,
        PLAYLIST_PUSH: 26,
        PLAYLIST_POP: 27,
        COMMENT_EDIT: 28,
        ACCOUNT_AUTHORIZE: 29,
        ACCOUNT_REVOKE: 30,
        FUND_REQUEST_CREATE: 31,
        FUND_REQUEST_CONTRIB: 32,
        FUND_REQUEST_WORK: 33,
        FUND_REQUEST_WORK_REVIEW: 34,
        PROPOSAL_VOTE: 35,
        PROPOSAL_EDIT: 36,
        CHAIN_UPDATE_CREATE: 37,
        MD_QUEUE: 38,
        MD_SIGN: 39,
        NFT_AUCTION_CREATE: 40,
        NFT_AUCTION_BID: 41,
        VERIFY_REQUEST: 42,
        VERIFY_RESPONSE: 43
    },
    validate: (tx, ts, legitUser, cb) => {
        // logr.debug('tx:'+tx.type+' validation begins')
        let startTime = performance.now()
        // will make sure the transaction type exists (redondant ?)
        if (!transactions[tx.type]) {
            logr.error('No transaction type ?!')
            cb(false, 'forbidden transaction type'); return
        }

        // enforce there's no unknown field included in the transaction
        for (let i = 0; i < Object.keys(tx.data).length; i++)
            if (transactions[tx.type].fields.indexOf(Object.keys(tx.data)[i]) === -1) {
                cb(false, 'unknown tx.data.'+Object.keys(tx.data)[i])
                return
            }

        transactions[tx.type].validate(tx, ts, legitUser, function(isValid, error) {
            let timeDiff = performance.now()-startTime
            if (timeDiff > WARN_SLOW_VALID)
                logr.warn('Slow tx type:'+tx.type+' validation took: '+timeDiff.toFixed(3)+'ms')
            else
                logr.perf('tx:'+tx.type+' validation finish: '+timeDiff.toFixed(3)+'ms')

            cb(isValid, error)
        })
    },
    execute: (tx, ts, cb) => {
        // logr.debug('tx:'+tx.type+' execution begins')
        let startTime = performance.now()
        if (!transactions[tx.type]) {
            cb(false); return
        }
        transactions[tx.type].execute(tx, ts, function(isValid, dist, burn, vp) {
            let timeDiff = performance.now()-startTime
            
            if (timeDiff > WARN_SLOW_EXEC)
                logr.warn('Slow tx type:'+tx.type+' execution took: '+timeDiff.toFixed(3)+'ms')
            else
                logr.perf('tx:'+tx.type+' execution finish: '+timeDiff.toFixed(3)+'ms')

            cb(isValid, dist, burn, vp)
        })
    },
    transactions: transactions
}
