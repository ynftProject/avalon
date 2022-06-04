const int = require('./integer')
const float = require('./float')
const array = require('./array')

let types = {
    posInt: (val) => int(val,true,false),
    posNonZeroInt: (val) => int(val,false,false),
    posFloat: (val) => float(val,true,false),
    posNonZeroFloat: (val) => float(val,false,false),
    daoMembersArray: (val) => array(val,config.daoMembersMax),
    posBasisPoints: (val) => int(val,true,false,10000,0)
}

// proposals to update any of these must be specified along with the other fields in the same group
let groups = {
    ose: {
        members: ['ecoAuthorReward','ecoCurationReward','ecoMasterFee'],
        validate: (v1,v2,v3) => v1+v2+v3 === 10000
    },
    tse: {
        members: ['ecoAuthorRewardOwning','ecoCurationRewardOwning','ecoMasterFeeOwning'],
        validate: (v1,v2,v3) => v1+v2+v3 === 10000
    },
    earnLimit: {
        members: ['earningLimitFactorPEL','earningLimitFactorRPEL'],
        validate: (v1,v2) => v1 < v2
    }
}

let groupsInv = (() => {
    let result = {}
    for (let g in groups)
        for (let p in groups[g].members)
            result[groups[g].members[p]] = g
    return result
})()

let parameters = {
    accountPriceBase: types.posNonZeroInt,
    accountPriceCharMult: types.posFloat,
    accountPriceChars: types.posNonZeroInt,
    accountPriceMin: types.posInt,

    ecoAuthorReward: types.posBasisPoints,
    ecoCurationReward: types.posBasisPoints,
    ecoMasterFee: types.posBasisPoints,
    ecoAuthorRewardOwning: types.posBasisPoints,
    ecoCurationRewardOwning: types.posBasisPoints,
    ecoMasterFeeOwning: types.posBasisPoints,

    rewardPoolMaxShare: types.posFloat,
    rewardPoolAmount: types.posNonZeroInt,

    masterDaoTxExp: types.posInt,
    preloadBwGrowth: types.posFloat,
    vpCapFactor: types.posNonZeroFloat,
    vpCapFloor: types.posNonZeroInt,
    earningLimitFactorPEL: types.posNonZeroFloat,
    earningLimitFactorRPEL: types.posNonZeroFloat,
    earningLimitFloor: types.posNonZeroInt,
    earningLockNftPremium: types.posNonZeroFloat,
    distPoolCycle: types.posNonZeroInt,
    ammFee: types.posBasisPoints,

    daoMembers: types.daoMembersArray,
    daoMembersMax: types.posInt,
    daoVotingPeriodSeconds: types.posNonZeroInt,
    daoVotingThreshold: types.posNonZeroInt,
    chainUpdateFee: types.posNonZeroInt,
    chainUpdateMaxParams: types.posNonZeroInt,
    chainUpdateGracePeriodSeconds: types.posNonZeroInt,
    fundRequestBaseFee: types.posNonZeroInt,
    fundRequestSubFee: types.posInt,
    fundRequestSubMult: types.posNonZeroInt,
    fundRequestSubStart: types.posInt,
    fundRequestContribPeriodSeconds: types.posNonZeroInt,
    fundRequestDeadlineSeconds: types.posNonZeroInt,
    fundRequestDeadlineExtSeconds: types.posNonZeroInt,
    fundRequestReviewPeriodSeconds: types.posNonZeroInt,

    nftSaleFee: types.posBasisPoints,
    nftFloorPrice: types.posNonZeroInt,
    nftMaxExpSeconds: types.posNonZeroInt,
    nftMaxBids: types.posNonZeroInt
}

module.exports = {
    groups,
    groupsInv,
    parameters
}