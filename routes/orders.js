const moment = require('moment');
const express = require('express');
const router = express.Router();
const Joi = require('joi');

const constants = require('../helpers/constants');
const authEmployeeToken = require('../middlewares/authEmployeeToken');
const authUserToken = require('../middlewares/authUserToken');
const authAdminToken = require('../middlewares/authAdminToken');
const {isOrderValid, addPrices} = require('../helpers/orderHelpers');

const sqlconn = require('../helpers/sqlconn');

const _ = require('lodash');


router.get('/', authEmployeeToken, (req, res) => {

    query = 'SELECT * FROM User_Orders INNER JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid INNER JOIN Products \
            ON User_Order_Lines.pid=Products.pid \
            ORDER BY User_Orders.date_time DESC;';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        return res.status(200).send(rows);
    });
});


router.get('/me', authUserToken, (req, res) => {

    query = 'SELECT * FROM User_Orders INNER JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid INNER JOIN Products \
            ON User_Order_Lines.pid=Products.pid WHERE uid='+ sqlconn.escape(req.user.uid) +
        ' ORDER BY User_Orders.date_time DESC, User_Orders.uoid DESC;';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        return res.status(200).send(rows);
    });
});


router.get('/:id', authEmployeeToken, (req, res) => {
    query = 'SELECT * FROM User_Orders INNER JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uolid INNER JOIN Products \
            ON User_Order_Lines.pid=Products.pid WHERE User_Orders.uoid='+ sqlconn.escape(req.params.id) + ';';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        return res.status(200).send(rows);
    });
});


router.post('/', authUserToken, async (req, res) => {

    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message)

    let cart = req.body.cart;
    const del_address = req.body.del_address;

    const uid = req.user.uid;
    const date_time = moment().format().toString();

    const orderIsValid = await isOrderValid(cart);

    if (!orderIsValid) return res.status(400).send('Invalid products or flavors.');

    let query;
    
    cart = await addPrices(cart);
    if (cart === false) return res.status(500).send('Internal server error.');

    let totalPrice = 0;
    cart.forEach(product => totalPrice += product.price);

    console.log("-----------------", cart, "-----------------");

    // return await cart;  
    
    if (req.body.ccard == null) {
        query = 'INSERT INTO User_Orders (uid, del_address, date_time, total_price) \
            VALUES ('+ sqlconn.escape(uid) + ','
            + sqlconn.escape(del_address) + ','
            + sqlconn.escape(date_time) + ','
            + sqlconn.escape(totalPrice) + ');\
            SELECT LAST_INSERT_ID();';
    } else {
        const cc_number = req.body.ccard.cc_number;
        let cc_expdate = req.body.ccard.cc_expdate;
        cc_expdate = moment(cc_expdate, 'YYYY-MM').format().toString();

        query = 'INSERT INTO User_Orders (uid, del_address, cc_number, cc_expdate, date_time, total_price) \
            VALUES ('+ sqlconn.escape(uid) + ','
            + sqlconn.escape(del_address) + ','
            + sqlconn.escape(cc_number) + ','
            + sqlconn.escape(cc_expdate) + ','
            + sqlconn.escape(date_time) + ','
            + sqlconn.escape(totalPrice) + ');\
            SELECT LAST_INSERT_ID();';
    }
    sqlconn.getConnection((err, connection)=>{
        connection.beginTransaction((err)=>{
            if(err){

                console.log("POINT 0", err);
                
                connection.rollback(()=>{
                    connection.release();
                });
                return res.status(500).send('Unable to complete order. ' + err);
            }
            else{
                connection.query(query, (err, rows, fields)=>{
                    if (err) {

                        console.log("POINT 1", err);
                        
                        connection.rollback(() => {
                            connection.release();
                        });
                        return res.status(500).send('Unable to complete order. ' + err);
                    }
                    else {
                        const uoid = rows[0].insertId;
                        
                        query = 'INSERT INTO User_Order_Lines (uoid, pid, amount, price) VALUES ';
                        for (i = 0; i < cart.length; i++) {
                            query += '(' + connection.escape(uoid) + ',' + connection.escape(cart[i].pid) + ',' + 
                                    connection.escape(cart[i].amount) + ',' + connection.escape(cart[i].price) + ')';

                            if (i === cart.length - 1) query += ';';
                            else query += ',';
                        }

                        connection.query(query, async (err, rows, fields) => {
                            if (err){

                                console.log("POINT 2", err);
                                
                                connection.rollback(() => {
                                    connection.release();
                                });
                                return res.status(500).send('Database error. ' + err);
                            } else {

                                query = 'SELECT * FROM User_Order_Lines WHERE uoid=' + connection.escape(uoid) + ' AND pid=' + constants.CUSTOMIZED_ID + ';';

                                connection.query(query, (err, rows, fields) => {
                                    const customProducts = cart.filter(product => product.pid===constants.CUSTOMIZED_ID);
                                    const userOrderLines = rows;
                                    
                                    if(err || userOrderLines.length !== customProducts.length){

                                        console.log("POINT 3 USER ORDER LINES", userOrderLines);
                                        console.log("POINT 3 CUSTOM PRODUCTS", customProducts);
                                        console.log("POINT 3", err);

                                        connection.rollback(() => {
                                            connection.release();
                                        });
                                        return res.status(500).send('Database error. ' + err);
                                    }
                                    else{

                                        console.log('customProducts', customProducts);
                                        console.log('userOrderLines', userOrderLines);

                                        query = 'INSERT INTO Customized_Flavors (uolid, fid) VALUES';
                                        
                                        const insertedFlavors = [];
                                        
                                        for (i = 0; i < userOrderLines.length; i++) {
                                            for (j = 0; j < customProducts[i].flavors.length; j++ ){
                                                const flavor = customProducts[i].flavors[j];

                                                query += '(' + connection.escape(userOrderLines[i].uolid) + ',' + connection.escape(flavor) + ')';
                                                insertedFlavors.push(flavor);
                                                if (j < customProducts[i].flavors.length - 1) query += ',';
                                            }
                                            if ( i === userOrderLines.length - 1 ) query += ';';
                                            else if (customProducts[i+1].flavors.length !== 0) query += ',';
                                        }

                                        console.log(query);
                                        
                                        if (insertedFlavors.length===0){

                                            connection.commit((err) => {
                                                if (err) {
                                                    return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                                }
                                                connection.release();
                                                return res.status(200).send('Order completed.');
                                            });
                                       
                                        } else {
                                            
                                            connection.query(query, (err, rows, fields) => {
                                                if (err){

                                                    console.log("POINT 4", err);
                                                    
                                                    connection.rollback(() => {
                                                        connection.release();
                                                    });
                                                    return res.status(500).send('Database error. ' + err);
                                                } else{
                                                    connection.commit((err) => {
                                                        if (err) {
                                                            return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                                        }
                                                        connection.release();
                                                        return res.status(200).send('Order completed.');
                                                    });
                                                }
                                            });
                                        }
                                    }   
                                });
                            }
                        });                        
                    }
                });
            }
        });
    });


    /*

    sqlconn.query(query, function (err, rows, fields) {

        if (err) failed(err);
        else {
            const uoid = rows[0].insertId;
            
            cart.forEach(product => {
                //console.log(product);
                query = 'INSERT INTO User_Order_Lines (uoid, pid) \
                        VALUES ('+ sqlconn.escape(uoid) + ','
                    + sqlconn.escape(product.pid) + ');\
                        SELECT LAST_INSERT_ID();';

                sqlconn.query(query, async (err, rows, fields) => {
                    //console.log(rows[0].insertId);
                    if (err) {
                        //console.log('err2');
                        failed(err);
                    }
                    else {
                        const uolid = rows[0].insertId;
                        if (product.pid == constants.CUSTOMIZED_ID) {

                            const custom = new Custom({
                                uolid: uolid,
                                name: product.custom_name,
                            });

                            
                            await custom.save((err, custom) => {
                                if (err) console.log('Unable to insert custom. ' + err);
                            });

                            product.flavors.forEach(flavor => {
                                query = 'INSERT INTO Customized_Flavors (uolid, fid) \
                                VALUES ('+ sqlconn.escape(uolid) + ','
                                    + sqlconn.escape(flavor) + ');';
                                sqlconn.query(query, function (err, rows, fields) {
                                    if (err) {
                                        //console.log('Failed to insert to Customized_Flavors');
                                        failed(err);
                                    } else {
                                        //console.log('Inserted to Customized_Flavors');
                                    }
                                });
                            })
                        }
                    }
                });
            });

            return res.status(200).send('Order inserted.');
    }
    function failed(err) {
        return res.status(400).send('Unable to insert. ' + err);
    }
    */
});


function validatePost(order) {
    const schema = {
        cart: Joi.array().items(Joi.object().keys({
            pid: Joi.number().required(),
            flavors: Joi.array().items(Joi.number()).required(),
            amount: Joi.number().default(1).min(1).required()
        })).required().min(1),
        ccard: Joi.object().keys({
            cc_number: Joi.string().min(8).max(32).required(),
            cc_cvv: Joi.string().min(2).max(7).required(),
            cc_expdate: Joi.date().required()
        }),
        del_address: Joi.string().max(256)
    }
    return Joi.validate(order, schema);
}


module.exports = router;