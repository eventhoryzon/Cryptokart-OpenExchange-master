// A Router that Handles Account Info 

const Request = require("request-promise");
const Joi = require("joi");
const helper = require("../app").helper;
 
module.exports = (app) => {

//  Creation of Accounts Using JOI we validate body 
//  If correct we call createAccount function from our helper class :)
    app.post("/account", (request, response) => {
        var model = Joi.object().keys({
            firstname: Joi.string().required(),
            lastname: Joi.string().required(),
            type: Joi.string().forbidden().default("account")
        });
        Joi.validate(request.body, model, { stripUnknown: true }, (error, value) => {
            if(error) {
                return response.status(500).send(error);
            }
            helper.createAccount(value).then(result => {
                response.send(value);
            }, error => {
                response.status(500).send(error);
            });
        });
    });

// Lets Assume Account is created using Account id now we call our addAdrress function from the helper class.
    app.put("/account/address/:id", (request, response) => {
        helper.addAddress(request.params.id).then(result => {
            response.send(result);
        }, error => {
            return response.status(500).send(error);
        });
    });
//  Gets all addresses for the particular account
    app.get("/account/addresses/:id", (request, response) => {
        helper.getAddresses(request.params.id).then(result => {
            response.send(result);
        }, error => {
            response.status(500).send(error);
        });
    });
// Gets all addresses for the all the accounts.
    app.get("/addresses", (request, response) => {
        helper.getAddresses().then(result => {
            response.send(result);
        }, error => {
            response.status(500).send(error);
        });
    });
// Gets balance of the holding account and each of the wallet addresses.
// We Add them up to get the total balance
    app.get("/account/balance/:id", (request, response) => {
        helper.getAddresses(request.params.id).then(addresses => helper.getWalletBalance(addresses)).then(balance => {
            helper.getAccountBalance(request.params.id).then(result => {
                response.send({ "balance": balance.balance + result.balance });
            }, error => {
                response.status(500).send({ "code": error.code, "message": error.message });
            });
        }, error => {
            response.status(500).send({ "code": error.code, "message": error.message });
        });
    });
// Gets wallet Balance and returns a response.
    app.get("/address/balance/:id", (request, response) => {
        helper.getWalletBalance([request.params.id]).then(balance => {
            response.send(balance);
        }, error => {
            response.status(500).send({ "code": error.code, "message": error.message });
        });
    });

}