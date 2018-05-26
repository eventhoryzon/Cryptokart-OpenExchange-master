
const Couchbase = require("couchbase");
const Request = require("request-promise");
const UUID = require("uuid");
const Bitcore = require("bitcore-lib");


// Core Class : Core Logic of the Exchange 
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
 
// Creation of a user account 
// Accounts are driven by auto incrementing numeric value 
// Since i am using couchbase we can create increamenting values by using counter
// if there is no counter value we initialize it at 1 and increament on every next call (0 is reserved for application keys)
createAccount(data) {
    return new Promise((resolve, reject) => {
        this.bucket.counter("accounts::total", 1, { "initial": 1 }, (error, result) => {
            if(error) {
                reject({ "code": error.code, "message": error.message });
            }
            // adding the value to data object
            data.account = result.value;
            // generation of unique id 
            this.insert(data).then(result => {
                resolve(result);
            }, error => {
                reject(error);
            });
        });
    });
}
//  assuming an account has no address info just account identifier
//  We Add an address for the user by taking the users document.id and then create fresh key pairs from 10000 options.
//  using a sub document operation we can add key pair to document without downloading or manipulating the document.
//  I am storing the unencrypting private and public address in the user document(ENCRYPTION NEEDED FOR PRODUCTION MODE)- This is just for testing purposes. 
addAddress(account) {
    return new Promise((resolve, reject) => {
        this.bucket.get(account, (error, result) => {
            if(error) {
                reject({ "code": error.code, "message": error.message });
            }
            var keypair = this.createKeyPair(result.value.account);
            this.bucket.mutateIn(account).arrayAppend("addresses", keypair, true).execute((error, result) => {
                if(error) {
                    reject({ "code": error.code, "message": error.message });
                }
                resolve({ "address": keypair.address });
            });
        });
    });
}
//  We did create balance functions but those check each individual wallet balance not account balance.
//  This function checks the Account Balance by aggregation of +ve Deposits and -ve transfers an withdrawals.(excluding wallet balance)
    getAccountBalance(account) { 
        var statement = "SELECT SUM(tx.satoshis) AS balance FROM " + this.bucket._name + " AS tx WHERE tx.type = 'transaction' AND tx.account = $account";
        var query = Couchbase.N1qlQuery.fromString(statement);
        return new Promise((resolve, reject) => {
            this.bucket.query(query, { "account": account }, (error, result) => {
                if(error) {
                    reject({ "code": error.code, "message": error.message });
                }
                resolve({ "balance": result[0].balance });
            });
        });
    }

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
//  Getting private key of child addresses derived from master i.e. 10 Addresses that are genrated at random.
     getMasterChangeAddress() {
        var account = this.master.deriveChild(0);
        var key = account.deriveChild(Math.random() * 10 + 1);
        return { "secret": key.privateKey.toWIF().toString(), "address": key.privateKey.toAddress().toString() }
    }

//  If an account was provided 
//  we’ll use a N1QL query provided by couchbase 
//  to get all addresses for that particular account
//  If no account is provided then we get all the public addresses for every account in the database.(REQUIRED FOR LOGGING PURPOSES)
//  Using UNNEST Operator for a clean response.
//  WHERE Condition gives us matching addresses.
    getAddresses(account) {
            var statement, params;
            if(account) {
                statement = "SELECT VALUE addresses.address FROM " + this.bucket._name + " AS account USE KEYS $id UNNEST account.addresses as addresses";
                params = { "id": account };
            } else {
                statement = "SELECT VALUE addresses.address FROM " + this.bucket._name + " AS account UNNEST account.addresses as addresses WHERE account.type = 'account'";
            }
            var query = Couchbase.N1qlQuery.fromString(statement);
            return new Promise((resolve, reject) => {
                this.bucket.query(query, params, (error, result) => {
                    if(error) {
                        reject({ "code": error.code, "message": error.message });
                    }
                    resolve(result);
                });
            });
        }
        // no encryption due to time contraint 
        // this function gets the private key from address that helps to sign transactions.
        getPrivateKeyFromAddress(account, address) {
            var statement = "SELECT VALUE keypairs.secret FROM " + this.bucket._name + " AS account USE KEYS $account UNNEST account.addresses AS keypairs WHERE keypairs.address = $address";
            var query = Couchbase.N1qlQuery.fromString(statement);
            return new Promise((resolve, reject) => {
                this.bucket.query(query, { "account": account, "address": address }, (error, result) => {
                    if(error) {
                        reject({ "code": error.code, "message": error.message });
                    }
                    resolve({ "secret": result[0] });
                });
            });
        }
//  Parameters ( account, source address, destination address, amount)
//  First we get the balance from source and check UTXO availibility
//  Just did single address transactions. Can be extended to multiple addresses / Single transaction.
//  If there are funds we get private key and UTXO data (some value) and then create a bitcoin transaction
createTransactionFromAccount(account, source, destination, amount) {
    return new Promise((resolve, reject) => {
        this.getAddressBalance(source).then(sourceAddress => {
            if(sourceAddress.balanceSat < amount) {
                return reject({ "message": "Not enough funds in account." });
            }
            this.getPrivateKeyFromAddress(account, source).then(keypair => {
                this.getAddressUtxo(source).then(utxo => {
                    var transaction = new Bitcore.Transaction();
                    for(var i = 0; i < utxo.length; i++) {
                        transaction.from(utxo[i]);
                    }
                    transaction.to(destination, amount);
                    this.addAddress(account).then(change => {
                        transaction.change(change.address);
                        transaction.sign(keypair.secret);
                        resolve(transaction);
                    }, error => reject(error));
                }, error => reject(error));
            }, error => reject(error));
        }, error => reject(error));
    });
}

// If we want to transfer funds from our holding account?
// Assuming exchange address has a lot of coins to meet consumer demands.
// First check we make is to see whether there is funding in the holding account (Query that sums up transactions).
// We use the wallet of the exchange to be more secure rather than using a source wallet.(And transfer money from cold as per demands).
// after the transaction is signed. Create a transaction in the database and subtract the value of transfer.
    createTransactionFromMaster(account, destination, amount) {
    return new Promise((resolve, reject) => {
        this.getAccountBalance(account).then(accountBalance => {
            if(accountBalance.balance < amount) {
                reject({ "message": "Not enough funds in account." });
            }
            var mKeyPairs = this.getMasterKeyPairs();
            var masterAddresses = mKeyPairs.map(a => a.address);
            this.getMasterAddressWithMinimum(masterAddresses, amount).then(funds => {
                this.getAddressUtxo(funds.address).then(utxo => {
                    var transaction = new Bitcore.Transaction();
                    for(var i = 0; i < utxo.length; i++) {
                        transaction.from(utxo[i]);
                    }
                    transaction.to(destination, amount);
                    var change = helper.getMasterChangeAddress();
                    transaction.change(change.address);
                    for(var j = 0; j < mKeyPairs.length; j ++) {
                        if(mKeyPairs[j].address == funds.address) {
                            transaction.sign(mKeyPairs[j].secret);
                        }
                    }
                    var tx = {
                        account: account,
                        satoshis: (amount * -1),
                        timestamp: (new Date()).getTime(),
                        status: "transfer",
                        type: "transaction"
                    };
                    this.insert(tx).then(result => {
                        resolve(transaction);
                    }, error => reject(error));
                }, error => reject(error));
            }, error => reject(error));
        }, error => reject(error));
    });
}
}
 
module.exports = Helper;