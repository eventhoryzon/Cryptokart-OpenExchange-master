
const Couchbase = require("couchbase");
const Request = require("request-promise");
const UUID = require("uuid");
const Bitcore = require("bitcore-lib");
 
class Helper {
 
    constructor(host, bucket, username, password, seed) {
        this.cluster = new Couchbase.Cluster("couchbase://" + host);
        this.cluster.authenticate(username, password);
        this.bucket = this.cluster.openBucket(bucket);
        this.master = seed;
    }
//  Function to create Key Pairs from the master-
//  variable that represents the top level seed key and 
//  then we can derive user accounts as a child from the  master seed key.
    createKeyPair(account) { 
        var account = this.master.deriveChild(account);
        // Each account will have 10000 public and private keys.
        var key = account.deriveChild(Math.random() * 10000 + 1);
        // once generated we return it 
        return { "secret": key.privateKey.toWIF().toString(), "address": key.privateKey.toAddress().toString() }
    }
//  Total balance from all the addresses and return the total balance.
    getWalletBalance(addresses) { 
        var promises = [];
        for(var i = 0; i < addresses.length; i++) {
            promises.push(Request("https://insight.bitpay.com/api/addr/" + addresses[i]));
        }
        return Promise.all(promises).then(result => {
            var balance = result.reduce((a, b) => a + JSON.parse(b).balanceSat, 0);
            return new Promise((resolve, reject) => {
                resolve({ "balance": balance });
            });
        });
    }
//  function takes address as a parameter and returns balance in decimal format.(including satoshis)
    getAddressBalance(address) { 
    return Request("https://insight.bitpay.com/api/addr/" + address);
     }
//  before transfer need to check the unspent transaction output for the given address.
//  If null throw an error and reject the promise.
    getAddressUtxo(address) {
    return Request("https://insight.bitpay.com/api/addr/" + address + "/utxo").then(utxo => {
        return new Promise((resolve, reject) => {
            if(JSON.parse(utxo).length == 0) {
                reject({ "message": "There are no unspent transactions available." });
            }
            resolve(JSON.parse(utxo));
        });
    });
}
//  Creating some data in the database
//  Accepts object and id used as document key (if not provided we autogenrate it).
//  returns created id and response that resolves data 
    insert(data, id = UUID.v4()) {
        return new Promise((resolve, reject) => {
            this.bucket.insert(id, data, (error, result) => {
                if(error) {
                    reject({ "code": error.code, "message": error.message });
                }
                data.id = id;
                resolve(data);
            });
        });
    }
 
    createAccount(data) { }
 
    addAddress(account) { }
 
    getAccountBalance(account) { }

//  function to start creating accounts.
//  Allocation of 10 possibles addresses to the account
    getMasterAddresses() {
        var account = this.master.deriveChild(0);
        var key = account.deriveChild(Math.random() * 10 + 1);
        return { "secret": key.privateKey.toWIF().toString(), "address": key.privateKey.toAddress().toString() }    
     }
// function to give all master keys 
// Useful for signing and checking volume
// As this is a test app i am using a finite value of keys i.e. 10 (which can vary)
    getMasterKeyPairs() {
    var keypairs = [];
    var key;
    var account = this.master.deriveChild(0);
    for(var i = 1; i <= 10; i++) {
        key = account.deriveChild(i);
        keypairs.push({ "secret": key.privateKey.toWIF().toString(), "address": key.privateKey.toAddress().toString() });
    }
    return keypairs
     }
//  taking addresses and amount as parameters and checking if amount is more than thresold provided by the exchange
    getMasterAddressWithMinimum(addresses, amount) {
        var promises = [];
        for(var i = 0; i < addresses.length; i++) {
            promises.push(Request("https://insight.bitpay.com/api/addr/" + addresses[i]));
        }
        return Promise.all(promises).then(result => {
            for(var i = 0; i < result.length; i++) {
                if(result[i].balanceSat >= amount) {
                    return resolve({ "address": result[i].addrStr });
                }
            }
            reject({ "message": "Not enough funds in exchange" });
        });
     }
 
    getMasterChangeAddress() { }
 
    getAddresses(account) { }
 
    getPrivateKeyFromAddress(account, address) { }
 
    createTransactionFromAccount(account, source, destination, amount) { }
 
    createTransactionFromMaster(account, destination, amount) { }
 
}
 
module.exports = Helper;