module.exports = {
    init: (app) => {
        app.get('/amm/ynft/:token',(req,res) => {
            // fetch AMM liquidity pool info
            let token = req.params.token
            if (!token)
                return res.status(404).send({ error: 'token does not exist' })
            db.collection('ammPools').findOne({_id: 'ynft/'+req.params.token.toUpperCase()},(err,pool) => {
                if (err)
                    return res.status(500).send({error: 'failed to retrieve liquidity pool info'})
                else if (!pool)
                    return res.status(404).send({error: 'liquidity pool does not exist'})
                else
                    return res.send(pool)
            })
        })
    }
}