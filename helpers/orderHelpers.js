const sqlconn = require('./sqlconn');
const constants = require('./constants');

// helper functions to assist in creating orders

// check if order is valid by checking if the products and flavors exist in the database
async function isOrderValid(order) {
    if (order.length < 1) return false;
    
    const products = [];
    const flavors = [];
    
    // get product and flavor ids from the orderLines and add to the respective temporary arrays 
    order.forEach(orderLine => {
        if (!products.includes(orderLine.pid)) products.push(orderLine.pid);

        orderLine.flavors.forEach(fid => {
            if (!flavors.includes(fid)) flavors.push(fid);
        });
    });

    // check if products and flavors exist
    try {
        const productsAreValid = await productsExist(products);
        const flavorsAreValid = await flavorsExist(flavors);
        if (productsAreValid && flavorsAreValid) return true;
        else return false;

    } catch (err) {
    }
}

// check if products exist in the database
function productsExist(products) {
    return new Promise((resolve, reject) => {

        if (products.length == 0) return resolve(true);

        query = 'SELECT * FROM Products WHERE';

        for (i = 0; i < products.length; i++) {
            if (i == 0) {
                query = query + ' pid=' + sqlconn.escape(products[i]);
            } else {
                query = query + ' or pid=' + sqlconn.escape(products[i]);
            }
        }
        query = query + ';';

        sqlconn.query(query, function (err, rows, fields) {
            if (rows.length < products.length) return resolve(false);
            rows.forEach(row => {
                if (!row.active) return resolve(false);
            });
            return resolve(true);
        });
    });
}

// check if flavors exist in the database
function flavorsExist(flavors) {
    return new Promise((resolve, reject) => {

        if (flavors.length == 0) return resolve(true);

        query = 'SELECT * FROM Flavors WHERE';

        for (i = 0; i < flavors.length; i++) {
            if (i == 0) {
                query = query + ' fid=' + sqlconn.escape(flavors[i]);
            } else {
                query = query + ' or fid=' + sqlconn.escape(flavors[i]);
            }
        }
        query = query + ';';

        sqlconn.query(query, function (err, rows, fields) {
            if (rows.length < flavors.length) return resolve(false);
            rows.forEach(row => {
                if (!row.active) return resolve(false);
            });
            return resolve(true);
        });
    });
}

// add price to each order line based on product price and flavor prices in the database and the amount  
async function addPrices(cart){

    return new Promise((resolve, reject) => {
        // query to get the products that are in the cart from the database
        let query = 'SELECT * FROM Products WHERE pid IN (';
        for(i = 0; i < cart.length; i++){
            query += sqlconn.escape(cart[i].pid);
            if(i < cart.length - 1) query += ',';
        }
        query += ')';

        //
        console.log(query);
        //


        // dictionaries for product and flavor prices
        let productPrices = {};
        let flavorPrices = {};

        // execute query
        sqlconn.query(query, async (err, rows, fields) => {
            if(err) return resolve(false);   

            // add product prices to productPrices dictionary
            rows.forEach(row => {
                productPrices[row.pid] = row.price
            });

            // array for flavors in cart  
            const cartFlavors = [] 
        
            // add flavors from each order line present in cart to the cartFlavors array
            cart.forEach(product=>{
                product.flavors.forEach(flavor => {                    
                    if( !cartFlavors.includes(flavor) ) cartFlavors.push(flavor);
                });
            }); 

            // finish if there are no flavors in cartFlavors
            if (cartFlavors.length === 0) return complete(resolve, cart, productPrices, flavorPrices); 

            // query to get the flavors that are in cartFlavors from the database
            query = 'SELECT * FROM Flavors WHERE fid IN (';
            for(i = 0; i < cartFlavors.length; i++){
                query += sqlconn.escape(cartFlavors[i]);
                if(i < cartFlavors.length - 1) query += ',';
            }
            query += ')';
            
            // execute query
            sqlconn.query(query, (err, rows, fields) => {
                if(err) return resolve(false);       

                // add flavor prices to flavorPrices dictionary
                rows.forEach(row => {
                    flavorPrices[row.fid] = row.price
                });

                return complete(resolve, cart, productPrices, flavorPrices);
            });
        });
    });
}

const complete = (resolve, cart, productPrices, flavorPrices ) => {
    // calculate and add the price of each order line in cart, based on product price, flavor prices, and amount
    for(i = 0; i < cart.length; i++){
        cart[i].price = productPrices[cart[i].pid];
        if (cart[i].pid === constants.CUSTOMIZED_ID) cart[i].flavors.forEach(flavor => cart[i].price += flavorPrices[flavor]);
        cart[i].price *= cart[i].amount;
    }
    
    return resolve(cart);
}

module.exports.addPrices = addPrices;
module.exports.isOrderValid = isOrderValid;