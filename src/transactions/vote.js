module.exports = {
    bsonValidate: true,
    fields: ['author','link','downvote'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.author, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            logr.debug('invalid tx data.author')
            cb(false); return
        }
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        if (transaction.VP(ts, legitUser) < 1)
            return cb(false, 'account does not have VP to vote with')
        if (typeof tx.data.downvote !== 'boolean')
            return cb(false, 'downvote must be a boolean value')

        // checking if content exists
        cache.findOne('contents', {_id: tx.data.author+'/'+tx.data.link}, function(err, content) {
            if (!content) {
                cb(false, 'invalid tx non-existing content'); return
            }
            if (!config.allowRevotes) 
                for (let i = 0; i < content.votes.length; i++) 
                    if (tx.sender === content.votes[i].u) {
                        cb(false, 'invalid tx user has already voted'); return
                    }
            cb(true)
        })
    },
    execute: async (tx, ts, cb) => {
        let voter = await cache.findOnePromise('accounts',{name: tx.sender})
        let vp = transaction.VP(ts, voter)
        let vote = {
            u: tx.sender,
            ts: ts,
            vt: vp,
            dv: tx.data.downvote
        }
        // monetary distribution (curation rewards)
        let dist = await eco.curation(tx.data.author, tx.data.link, vote)
        let content = await cache.findOnePromise('contents', {_id: tx.data.author+'/'+tx.data.link})
        if (!content.pa && !content.pp)
            rankings.update(tx.data.author, tx.data.link, vote, dist)
        cb(true, dist, 0, vp)
    }
}