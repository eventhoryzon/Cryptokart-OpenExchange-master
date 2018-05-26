//  One of our Endpoints of the group using express to model.
const Bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
 
module.exports = (app) => {
//  Generates mnemonic seeds (A paraphrase where each word is  converted into a numeric value)
    app.get("/mnemonic", (request, response) => {
        response.send({
            "mnemonic": (new Mnemonic(Mnemonic.Words.ENGLISH)).toString()
        });
    });
//  Getting the fiat value of the Bitcoin Balance 
    app.get("/balance/value", (request, response) => {
        Request("https://api.coinmarketcap.com/v1/ticker/bitcoin/").then(market => {
            response.send({ "value": "$" + (JSON.parse(market)[0].price_usd * request.query.balance).toFixed(2) });
        }, error => {
            response.status(500).send(error);
        });
    });
 
}