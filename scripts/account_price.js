config = require('../src/config.js').read(0)
eco = require('../src/economics.js')

let name = ''
console.log('Length\tPrice\t\t\tVP')
console.log('===========================================')
while (name.length < 20) {
    name += 'a'
    let price = (eco.accountPrice(name)/1000000)+' YNFT'
    let vp = Math.floor(eco.accountPrice(name)*config.vpPerBurn)+' VP'
    console.log(name.length+'\t'+price+'\t\t'+vp)
}