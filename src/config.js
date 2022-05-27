let config = {
    history: {
        0: {
            // this is the block 0 configuration for mainnet
            accountPriceBase: 20000,
            accountPriceCharMult: 4,
            accountPriceChars: 5,
            accountPriceMin: 200,
            accountMaxLength: 50,
            accountMinLength: 1,
            // allowed username chars
            allowedUsernameChars: 'abcdefghijklmnopqrstuvwxyz0123456789',
            allowedUsernameCharsOnlyMiddle: '-.',
            // should we allow people to vote multiple times on the same content ?
            allowRevotes: false,
            // the base58 encoding alphabet
            b58Alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
            // the block #0 genesis timestamp
            block0ts: 1653625800455,
            // the block time in ms
            blockTime: 3000,
            // the number of ms needed for 0.01 DTC to generate 1 byte of bw
            bwGrowth: 36000000, // +10 bytes per hour per DTC (3600 * 1000 * 100 / 10)
            // the maximum bandwidth an account can have available
            bwMax: 64000,
            // the number of rounds of consensus before block is valid (min 2)
            consensusRounds: 2,
            // the number of blocks from the past taken into consideration for econonomics
            ecoBlocks: 9600, // 8 hours
            // the precision of the claimable amounts
            ecoClaimPrecision: 3,
            ecoRentPrecision: 6,
            // author and voter split in basis points
            ecoAuthorReward: 4500,
            ecoCurationReward: 4500,
            ecoMasterFee: 1000,
            ecoAuthorRewardOwning: 1500,
            ecoCurationRewardOwning: 7500,
            ecoMasterFeeOwning: 1000,
            // the maximum number of follows a single account can do
            followsMax: 2000,
            // the max size of a stringified json input (content / user profile)
            // best if kept slightly lower than bwMax
            jsonMaxBytes: 60000,
            // the max length of a key identifier
            keyIdMaxLength: 25,
            // how many max leaders there can be, and how much tokens they earn per "mined" block
            leaderReward: 1,
            leaders: 15,
            // how long of the end of the block hash is used for the leader pseudo random generator shuffle
            leaderShufflePrecision: 6,
            // the maximum number of leaders an account can vote for
            leaderMaxVotes: 5,
            // the "master" account starting stake (total starting supply)
            // not applied if starting from a genesis.zip file
            masterBalance: 10000000000,
            // the init account username
            masterName: 'dtube',
            // if false master can create accounts with usernames without burning tokens
            masterPaysForUsernames: false,
            // the master account public original key (irrelevant if using genesis)
            masterPub: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz',
            // the master account public leader key  (irrelevant if using genesis)
            masterPubLeader: 'dTuBhkU6SUx9JEx1f4YEt34X9sC7QGso2dSrqE8eJyfz',
            // the maximum time drift in ms before a block is invalid
            maxDrift: 200,
            // the maximum number of transactions in a single block
            maxTxPerBlock: 20,
            // the max length of a transfer memo
            memoMaxLength: 250,
            // defines how long it takes for a notification to get deleted, and how often the purge happens
            // e.g.: purge notifications older than 56*3600 blocks every 3600 blocks
            notifPurge: 3600,
            notifPurgeAfter: 56,
            // the maximum number of mentions triggering a notification
            notifMaxMentions: 10,
            // the sha256sum hash of block 0 (new origin hash -> new chain)
            originHash: 'da5fe18d0844f1f97bf5a94e7780dec18b4ab015e32383ede77158e059bacbb3',
            // the default number of random bytes to use for new key generation
            randomBytesLength: 32,
            // the maximum share of the reward pool a single distribution can generate
            rewardPoolMaxShare: 0.1,
            // theoretical max reward pool in a cycle including leader rewards
            rewardPoolAmount: 150001,
            // the maximum length of tags (on votes)
            tagMaxLength: 25,
            tagMaxPerContent: 5,
            // precision of author tip percentage
            // 1 => 10% step, 2 => 1% step, 3 => 0.1% step, 4 => 0.01% step
            tippedVotePrecision: 2,
            // the time after which transactions expire and wont be accepted by nodes anymore
            txExpirationTime: 60000,
            // limit which transactions are available
            // key: transaction id (see transaction.js:TransactionType)
            // value: null/0 (default): enabled, 1: disabled, 2: master-only
            txLimits: {
                12: 2
            },
            // the number of ms needed for 0.01 DTC to generate 1 vt
            vpGrowth: 360000000, // +1 vt per hour per DTC (3600 * 1000 * 100)
            vpCapFactor: 10,
            vpCapFloor: 1000000,

            // hf4
            maxKeys: 25,
            disallowVotingInactiveLeader: true,
            burnAccount: 'null',
            preloadBwGrowth: 2, // x2 more time of bwGrowth
            multisig: true,

            // hf5
            masterNoPreloadAcc: true,

            // hf6
            accountAuthEnabled: true,

            // playlists
            playlistEnabled: true,
            playlistLinkMin: 3,
            playlistLinkMax: 50,
            playlistContentLinkMin: 1,
            playlistContentLinkMax: 101,
            playlistSequenceMax: 1000,
            playlistSequenceIdMax: 10000,

            // avalon dao
            daoEnabled: true,
            daoLeaderSnapshotBlocks: 30,
            daoMembers: [],
            daoMembersMax: 100,
            daoVotingPeriodSeconds: 604800,
            daoVotingThreshold: 50000000,
            daoVotingLeaderBonus: 1000000,
            chainUpdateFee: 30000,
            chainUpdateMaxParams: 20,
            chainUpdateGracePeriodSeconds: 86400,
            fundRequestBaseFee: 10000,
            fundRequestSubFee: 1,
            fundRequestSubMult: 100,
            fundRequestSubStart: 100000,
            fundRequestContribPeriodSeconds: 1209600,
            fundRequestDeadlineSeconds: 31536000,
            fundRequestDeadlineExtSeconds: 2592000,
            fundRequestReviewPeriodSeconds: 259200,

            // master dao
            masterDao: false,
            masterDaoTxs: [0,4,5,6,10,11,13,14,15,17,19,20,21,23,24,25,26,27,28,29,30,32],
            masterDaoTxExp: 259200000,

            // maximum tx expiration allowed (block ts + 1 hour)
            txExpirationMax: 3600000,

            // nft
            // fee for every nft market sale/auction (basis points)
            nftSaleFee: 1000,
            // floor price
            nftFloorPrice: 100,
            // max order expiration (30 days)
            nftMaxExpSeconds: 2592000,
            // max bids per account
            nftMaxBids: 1000,

            // genesis nft issued by master account
            nftGenesis: 500,
            nftGenesisStartPrice: 100
        }
    },
    read: (blockNum) => {
        let finalConfig = {}
        let latestHf = 0
        for (const key in config.history) 
            if (blockNum >= key) {
                if (blockNum === parseInt(key) && blockNum !== 0)
                    logr.info('Hard Fork #'+key)
                Object.assign(finalConfig, config.history[key])
                latestHf = parseInt(key)
            }
            else {
                if (config.history[key].ecoBlocks > finalConfig.ecoBlocks
                && config.history[key].ecoBlocks - finalConfig.ecoBlocks >= key-blockNum)
                    finalConfig.ecoBlocksIncreasesSoon = config.history[key].ecoBlocks
                
                break
            }
        if (typeof cache !== 'undefined' && cache.state && cache.state[1]) {
            let govConfig = cache.state[1]
            for (let k in govConfig)
                if (k !== '_id' && govConfig[k].effectiveBlock >= latestHf)
                    finalConfig[k] = govConfig[k].value
        }
        
        return finalConfig
    }
} 

module.exports = config
