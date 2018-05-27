// Inititalization, Loading config info , and linking up routes .
// Module.exports.helper variable is our singleton used everywhere.
const Express = require("express");
const BodyParser = require("body-parser");
const Bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
const Config = require("./config");
const Helper = require("./classes/helper");
 
var app = Express();
 
app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));
 
var mnemonic = new Mnemonic(Config.mnemonic);
var master = new Bitcore.HDPrivateKey(mnemonic.toHDPrivateKey());

var cluster = new Couchbase.Cluster("couchbase://" + Config.host);
 cluster.authenticate(Config.username, Config.password);
 var bucket = cluster.openBucket(Config.bucket);

module.exports.helper = new Helper(Config.host, Config.bucket, Config.username, Config.password, master);
 
require("./routes/account.js")(app);
require("./routes/transaction.js")(app);
require("./routes/utility.js")(app);
 
var server = app.listen(3333, () => {
    console.log("Listening at :" + server.address().port + "...");
});