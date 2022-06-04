module.exports = {
    init: (app) => {
        app.get('/blocktxs/:block',(req,res) => {
            const blockNum = parseInt(req.params.block)
            if (process.env.TX_HISTORY !== '1')
                return res.status(500).send({error: 'TX_HISTORY module is not enabled'})
            if (!blockNum || isNaN(blockNum) || blockNum < 0)
                return res.status(400).send({error: 'Block number must be a non-negative integer'})
            db.collection('txs').find({ includedInBlock: blockNum }).toArray((e,txs) => {
                return res.send(txs)
            })
        })
    }
}