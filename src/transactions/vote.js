module.exports = {
    bsonValidate: true,
    fields: ['link', 'author'],
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
            vt: vp
        }
        await cache.updateOnePromise('contents', {_id: tx.data.author+'/'+tx.data.link},{$push: { votes: vote }})
        let content = await cache.findOnePromise('contents', {_id: tx.data.author+'/'+tx.data.link})
        // monetary distribution (curation rewards)
        eco.curation(tx.data.author, tx.data.link, function(distCurators, distMaster) {
            if (!content.pa && !content.pp)
                rankings.update(tx.data.author, tx.data.link, vote, distCurators)
            cb(true, distCurators+distMaster)
        })
    }
}