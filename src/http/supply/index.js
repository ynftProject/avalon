const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /supply Supply
         * @apiName supply
         * @apiGroup Economics
         * 
         * @apiSuccess {Integer} circulating Circulating supply in user wallets that are immediately spendable
         * @apiSuccess {Double} unclaimed Unclaimed content rewards
         * @apiSuccess {Double} total Circulating supply and unclaimed rewards added
         */
        app.get('/supply', (req, res) => {
            db.collection('state').findOne({_id: 3},(e,r) => {
                if (e)
                    return res.status(500).send({error: 'failed to fetch supply info'})
                else
                    return res.send(r)
            })
        })
    }
}