module.exports = {
    init: (app) => {
        /**
         * @api {get} /averages Averages and Dist Pool
         * @apiName averages
         * @apiGroup Economics
         * 
         * @apiSuccess {Object} tvap The total average voting power across all accounts (as of last transaction)
         * @apiSuccess {Object} earning The total average earnings across all accounts
         * @apiSuccess {Object} currentDistPool The dist pool in the current cycle
         * @apiSuccess {Object} previousDistPool The dist pool in the last cycle
         */
        app.get('/averages',(req,res) => {
            db.collection('state').findOne({_id: 2},(e,state) => {
                if (e)
                    return res.status(500).send({error: 'failed to fetch data from db'})
                else
                    return res.send(state)
            })
        })
    }
}