const sqlconn = require('./sqlconn');
const constants = require('./constants');

async function isOrderValid(order) {
    if (order.length < 1) return false;
    
    const products = [];
    const flavors = [];
    
    order.forEach(order => {
        if (!products.includes(order.pid)) products.push(order.pid);

        order.flavors.forEach(fid => {
            if (!flavors.includes(fid)) flavors.push(fid);
        });
    });

    try {
        const productsAreValid = await productsExist(products);
        const flavorsAreValid = await flavorsExist(flavors);
        if (productsAreValid && flavorsAreValid) return true;
        else return false;

    } catch (err) {
    }
}

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
            if (rows.length === products.length) resolve(true);
            else resolve(false);
        });
    });
}

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

            if (rows.length === flavors.length) resolve(true);
            else resolve(false);
        });
    });
}

async function addPrices(cart){

    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM Products WHERE pid IN (';
        for(i = 0; i < cart.length; i++){
            query += sqlconn.escape(cart[i].pid);
            if(i < cart.length - 1) query += ',';
        }
        query += ')';

        let productPrices = {};
        let flavorPrices = {};

        sqlconn.query(query, async (err, rows, fields) => {
            
            console.log("product rows", err);
            console.log("product rows", rows);

            if(err) return resolve(false);   
            rows.forEach(row => {
                productPrices[row.pid] = row.price
            });

            console.log("productPrices", productPrices);

            const cartFlavors = [] 
        
            cart.forEach(product=>{
                product.flavors.forEach(flavor => {
                    
                    console.log(flavor)
                    
                    if( !(flavor in cartFlavors) ) cartFlavors.push(flavor);
                });
            }); 

            console.log("cartFlavors", cartFlavors);

            if (cartFlavors.length === 0) return complete(resolve, cart, productPrices, flavorPrices); 

            query = 'SELECT * FROM Flavors WHERE fid IN (';
            for(i = 0; i < cartFlavors.length; i++){
                query += sqlconn.escape(cartFlavors[i]);
                if(i < cartFlavors.length - 1) query += ',';
            }
            query += ')';

            
            sqlconn.query(query, (err, rows, fields) => {
                
                console.log("flavor rows", err);
                console.log("flavor rows", rows);
                
                if(err) return resolve(false);       
                rows.forEach(row => {
                    flavorPrices[row.fid] = row.price
                });

                console.log("flavorPrices", flavorPrices);

                return complete(resolve, cart, productPrices, flavorPrices);
            });
        });
    });
}
const complete = (resolve, cart, productPrices, flavorPrices ) => {
    for(i = 0; i < cart.length; i++){
        cart[i].price = productPrices[cart[i].pid];
        if (cart[i].pid === constants.CUSTOMIZED_ID) cart[i].flavors.forEach(flavor => cart[i].price += flavorPrices[flavor]);
        cart[i].price *= cart[i].amount;
    }
    
    return resolve(cart);
}


module.exports.addPrices = addPrices;
module.exports.isOrderValid = isOrderValid;