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

const sortList = require("../helpers/sortList");


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

    // query = 'SELECT * FROM User_Orders WHERE uid='+ sqlconn.escape(req.user.uid) +
    //         ' ORDER BY User_Orders.date_time DESC, User_Orders.uoid DESC;';

    query = 'SELECT User_Orders.uoid as uoid, User_Orders.uid as uid, date_time, total_price, del_address, phone_number, \
            User_Order_Lines.uolid as uolid, Products.pid as pid, amount, Products.price as productPrice, \
            Products.name as productName, Flavors.price as flavorPrice, Flavors.name as flavorName, \
            image, cfid, Flavors.fid as fid FROM User_Orders LEFT JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid LEFT JOIN Products \
            ON User_Order_Lines.pid=Products.pid LEFT JOIN Customized_Flavors \
            ON User_Order_Lines.uolid = Customized_Flavors.uolid LEFT JOIN Flavors \
            ON Customized_Flavors.fid = Flavors.fid WHERE uid=' + sqlconn.escape(req.user.uid) +
            ' ORDER BY User_Orders.uoid DESC, User_Orders.date_time DESC;';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);

        
        const userOrders = {};
        rows.forEach(row => {
            
            if (!(row.uoid in userOrders)) {
                userOrders[row.uoid] = 
                    {uoid:row.uoid, 
                    uid:row.uid, 
                    date_time: row.date_time, 
                    total_price: row.total_price,
                    del_address: row.del_address,
                    phone_number: row.phone_number,
                    cc_number: row.cc_number,
                    cc_expdate: row.cc_expdate,
                    order_lines: {}};
            }
            
            if(!(row.uolid in userOrders[row.uoid].order_lines)) {
                userOrders[row.uoid].order_lines[row.uolid] =
                    {uolid: row.uolid,
                    pid: row.pid,
                    amount: row.amount,
                    price: row.productPrice,
                    name: row.productName,
                    image: row.image,
                    flavors: []};
            }

            if (row.fid) {
                userOrders[row.uoid].order_lines[row.uolid].flavors.push({
                    fid: row.fid,
                    name: row.flavorName,
                    price: row.flavorPrice
                });
            }
        });

        const sortedUserOrders = sortList(Object.values(userOrders), true, "uoid");

        return res.status(200).send(sortedUserOrders);
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

    console.log("req.body", req.body);
    
    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message)

    let cart = req.body.cart;
    const del_address = req.body.del_address;
    const phone_number = req.body.phone_number;

    const uid = req.user.uid;
    const date_time = moment().format("YYYY-MM-DD HH:mm:ss").toString();


    console.log(date_time);

    const orderIsValid = await isOrderValid(cart);

    if (!orderIsValid) return res.status(400).send('Invalid products or flavors.');

    let query;
    
    cart = await addPrices(cart);
    if (cart === false) return res.status(500).send('Internal server error.');

    let totalPrice = 0;
    cart.forEach(product => totalPrice += product.price);
    
    if (req.body.ccard == null) {
        query = 'INSERT INTO User_Orders (uid, del_address, phone_number, date_time, total_price) \
            VALUES ('+ sqlconn.escape(uid) + ','
            + sqlconn.escape(del_address) + ','
            + sqlconn.escape(phone_number) + ','
            + sqlconn.escape(date_time) + ','
            + sqlconn.escape(totalPrice) + ');\
            SELECT LAST_INSERT_ID();';
    } else {
        const cc_number = req.body.ccard.cc_number;
        let cc_expdate = req.body.ccard.cc_expdate;
        cc_expdate = moment(cc_expdate, 'YYYY-MM').format().toString();

        query = 'INSERT INTO User_Orders (uid, del_address, phone_number, cc_number, cc_expdate, date_time, total_price) \
            VALUES ('+ sqlconn.escape(uid) + ','
            + sqlconn.escape(del_address) + ','
            + sqlconn.escape(phone_number) + ','
            + sqlconn.escape(cc_number) + ','
            + sqlconn.escape(cc_expdate) + ','
            + sqlconn.escape(date_time) + ','
            + sqlconn.escape(totalPrice) + ');\
            SELECT LAST_INSERT_ID();';
    }
    sqlconn.getConnection((err, connection)=>{
        connection.beginTransaction((err)=>{
            if(err){
                connection.rollback(()=>{
                    connection.release();
                });
                return res.status(500).send('Unable to complete order. ' + err);
            }
            else{
                connection.query(query, (err, rows, fields)=>{
                    if (err) {                        
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
                                        connection.rollback(() => {
                                            connection.release();
                                        });
                                        return res.status(500).send('Database error. ' + err);
                                    }
                                    else{

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
        }).allow(null),
        del_address: Joi.string().max(256),
        phone_number: Joi.string().max(32)
    }
    return Joi.validate(order, schema);
}


module.exports = router;