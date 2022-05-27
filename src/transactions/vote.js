module.exports = {
    bsonValidate: true,
    fields: ['author','link','downvote'],
    validate: async (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle))
            return cb(false)
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid tx data.link')
        if (await transaction.VP(ts, legitUser) < 1)
            return cb(false, 'account does not have VP to vote with')
        if (typeof tx.data.downvote !== 'boolean')
            return cb(false, 'downvote must be a boolean value')

        // checking if content exists
        let content = await cache.findOnePromise('contents', {_id: tx.data.author+'/'+tx.data.link})
        if (!content)
            return cb(false, 'invalid tx non-existing content')
        if (!config.allowRevotes) 
            for (let i = 0; i < content.votes.length; i++) 
                if (tx.sender === content.votes[i].u) {
                    cb(false, 'invalid tx user has already voted'); return
                }
        cb(true)
    },
    execute: async (tx, ts, cb) => {
        let voter = await cache.findOnePromise('accounts',{name: tx.sender})
        let vp = await transaction.VP(ts, voter)
        let vote = {
            u: tx.sender,
            ts: ts,
            vt: vp,
        }
        if (tx.data.downvote)
            vote.vt = vote.vt * -1
        // monetary distribution (curation rewards)
        let dist = await eco.curation(tx.data.author, tx.data.link, vote)
        let content = await cache.findOnePromise('contents', {_id: tx.data.author+'/'+tx.data.link})
        if (!content.pa && !content.pp)
            rankings.update(tx.data.author, tx.data.link, vote, dist)
        cb(true, dist, 0, vp)
    }
}