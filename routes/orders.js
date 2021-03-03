const moment = require('moment');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const _ = require('lodash');

const constants = require('../helpers/constants');
const authEmployeeToken = require('../middlewares/authEmployeeToken');
const authUserToken = require('../middlewares/authUserToken');
const authAdminToken = require('../middlewares/authAdminToken');
const {isOrderValid, addPrices} = require('../helpers/orderHelpers');

const sqlconn = require('../helpers/sqlconn');
const sortList = require("../helpers/sortList");

// get orders
router.get('/', authEmployeeToken, (req, res) => {

    // query to get orders with data joined from all relevant tables
    query = 'SELECT User_Orders.uoid as uoid, Users.firstname, Users.lastname, \
            User_Orders.uid as uid, date_time, total_price, del_address, status, \
            User_Orders.phone_number as phone_number, User_Order_Lines.uolid as uolid, Products.pid as pid, amount, \
            User_Order_Lines.price as price, Products.name as productName, Flavors.name as flavorName, \
            image, cfid, Flavors.fid as fid FROM User_Orders LEFT JOIN Users \
            ON User_Orders.uid = Users.uid LEFT JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid LEFT JOIN Products \
            ON User_Order_Lines.pid=Products.pid LEFT JOIN Customized_Flavors \
            ON User_Order_Lines.uolid = Customized_Flavors.uolid LEFT JOIN Flavors \
            ON Customized_Flavors.fid = Flavors.fid \
            ORDER BY User_Orders.uoid DESC, User_Orders.date_time DESC;';

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        // format orders
        userOrders = formatUserOrders(rows);
        // sort orders based on user order id 
        const sortedUserOrders = sortList(Object.values(userOrders), true, "uoid");
        // send orders
        return res.status(200).send(sortedUserOrders);
    });
});

// get orders from the current authenticated user
router.get('/me', authUserToken, (req, res) => {

    // query to get orders with data joined from all relevant tables
    query = 'SELECT User_Orders.uoid as uoid, Users.firstname, Users.lastname, \
            User_Orders.uid as uid, date_time, total_price, del_address, status, \
            User_Orders.phone_number as phone_number, User_Order_Lines.uolid as uolid, Products.pid as pid, amount, \
            User_Order_Lines.price as price, Products.name as productName, Flavors.name as flavorName, \
            image, cfid, Flavors.fid as fid FROM User_Orders LEFT JOIN Users \
            ON User_Orders.uid = Users.uid LEFT JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid LEFT JOIN Products \
            ON User_Order_Lines.pid=Products.pid LEFT JOIN Customized_Flavors \
            ON User_Order_Lines.uolid = Customized_Flavors.uolid LEFT JOIN Flavors \
            ON Customized_Flavors.fid = Flavors.fid WHERE User_Orders.uid=' + sqlconn.escape(req.user.uid) +
            ' ORDER BY User_Orders.uoid DESC, User_Orders.date_time DESC;';

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        // format orders
        userOrders = formatUserOrders(rows);    
        // sort orders based on user order id
        const sortedUserOrders = sortList(Object.values(userOrders), true, "uoid");
        // send orders
        return res.status(200).send(sortedUserOrders);
    });
});

// get order based on id
router.get('/:id', authEmployeeToken, (req, res) => {

    // query to get order with data joined from all relevant tables
    query = 'SELECT User_Orders.uoid as uoid, Users.firstname, Users.lastname, \
            User_Orders.uid as uid, date_time, total_price, del_address, status, \
            User_Orders.phone_number as phone_number, User_Order_Lines.uolid as uolid, Products.pid as pid, amount, \
            User_Order_Lines.price as price, Products.name as productName, Flavors.name as flavorName, \
            image, cfid, Flavors.fid as fid FROM User_Orders LEFT JOIN Users \
            ON User_Orders.uid = Users.uid LEFT JOIN User_Order_Lines \
            ON User_Orders.uoid = User_Order_Lines.uoid LEFT JOIN Products \
            ON User_Order_Lines.pid=Products.pid LEFT JOIN Customized_Flavors \
            ON User_Order_Lines.uolid = Customized_Flavors.uolid LEFT JOIN Flavors \
            ON Customized_Flavors.fid = Flavors.fid WHERE User_Orders.uoid='+ sqlconn.escape(req.params.id) + ';';
    
    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get orders. ' + err);
        // format order
        userOrders = formatUserOrders(rows);
        // send order
        return res.status(200).send(userOrders[req.params.id]);
    });
});

// change order status to cancelled
// only order owner can perform this operation
router.put('/cancel/:id', authUserToken, (req, res) => {
    
    const uoid = req.params.id;
    
    // query to check if order exists
    query = 'SELECT * FROM User_Orders WHERE uoid = ' + sqlconn.escape(uoid);

    let order;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        order = rows[0];
        if (!order) return res.status(400).send('Order does not exist.');
        else  {
            // if order does not belong to current user
            if (req.user.uid !== order.uid) return res.status(403).send('Access denied. Not allowed to perform operation.');

            // query to change order status to cancelled and employee id of the status changer to null 
            query = 'UPDATE User_Orders SET \
                    status = "Cancelled", status_changer_eid = \
                    NULL WHERE uoid = ' + sqlconn.escape(uoid);

            // execute query
            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);
                // query to get updated order
                query = 'SELECT * FROM User_Orders WHERE uoid=' + sqlconn.escape(uoid);
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    order = rows[0];
                    // send order
                    return res.status(200).send(order);
                });
            });
        }
    });
});

// change order status
router.put('/status/:id', authEmployeeToken, (req, res) => {
    const {error} = validateStatusPut(req.body);
    

    if (error) return res.status(400).send(error.details[0].message);

    const uoid = req.params.id;
    updatedOrder = _.pick(req.body, ['status']);

    // query to check if order exists
    query = 'SELECT * FROM User_Orders WHERE uoid = ' + sqlconn.escape(uoid);

    let order;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        order = rows[0];
        if (!order) return res.status(400).send('Order does not exist.');
        else  {
            // query to change order status to cancelled and employee id of the status changer to the employee id
            query = 'UPDATE User_Orders SET \
                    status = ' + sqlconn.escape(updatedOrder.status) +
                    ', status_changer_eid = ' + sqlconn.escape(req.employee.eid) +
                    ' WHERE uoid = ' + sqlconn.escape(uoid);

            // execute query
            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);
                // query to get updated order
                query = 'SELECT * FROM User_Orders WHERE uoid=' + sqlconn.escape(uoid);
                
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    order = rows[0];
                    return res.status(200).send(order);
                });
            });
        }
    });
});


router.post('/', authUserToken, async (req, res) => {
    // validate post
    const { error } = validatePost(req.body);
    if (error) return res.status(400).send(error.details[0].message);


    let cart = req.body.cart;
    const del_address = req.body.del_address;
    const phone_number = req.body.phone_number;

    const uid = req.user.uid;
    const date_time = moment().format("YYYY-MM-DD HH:mm:ss").toString();

    // check if order is valid
    const orderIsValid = await isOrderValid(cart);
    if (!orderIsValid) return res.status(400).send('Invalid products or flavors.');

    let query;
    // add prices to order lines in cart
    cart = await addPrices(cart);
    // if unable to add prices
    if (cart === false) return res.status(500).send('Internal server error.');

    let totalPrice = 0;
    // calculate total price of cart
    cart.forEach(product => totalPrice += product.price);
    

    /* query to insert order */

    // if no credit card is provided 
    if (req.body.ccard === null) {
        query = 'INSERT INTO User_Orders (uid, del_address, phone_number, date_time, total_price) \
            VALUES ('+ sqlconn.escape(uid) + ','
            + sqlconn.escape(del_address) + ','
            + sqlconn.escape(phone_number) + ','
            + sqlconn.escape(date_time) + ','
            + sqlconn.escape(totalPrice) + ');\
            SELECT LAST_INSERT_ID();';
    } 
    // if credit card is provided
    else {
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

    // get a connection from connection pool
    sqlconn.getConnection((err, connection)=>{
        // start transaction
        connection.beginTransaction((err)=>{
            if(err){
                connection.rollback(()=>{
                    connection.release();
                });

                return res.status(500).send('Unable to complete order. ' + err);
            }
            else{
                // execute order
                connection.query(query, (err, rows, fields)=>{
                    if (err) {                        
                        connection.rollback(() => {
                            connection.release();
                        });
                        return res.status(500).send('Unable to complete order. ' + err);
                    }
                    else {

                        const uoid = rows[0].insertId; // id of inserted order
                        
                        // query to insert order lines
                        query = 'INSERT INTO User_Order_Lines (uoid, pid, amount, price) VALUES ';
                        for (i = 0; i < cart.length; i++) {
                            query += '(' + connection.escape(uoid) + ',' + connection.escape(cart[i].pid) + ',' + 
                                    connection.escape(cart[i].amount) + ',' + connection.escape(cart[i].price) + ')';

                            if (i === cart.length - 1) query += ';';
                            else query += ',';
                        }

                        // execute query
                        connection.query(query, async (err, rows, fields) => {
                            if (err){                                
                                connection.rollback(() => {
                                    connection.release();
                                });
                                return res.status(500).send('Database error. ' + err);
                            } 
                            else {
                                // query to get inserted order lines of customized product
                                query = 'SELECT * FROM User_Order_Lines WHERE uoid=' + connection.escape(uoid) + ' AND pid=' + constants.CUSTOMIZED_ID + ';';

                                // execute query
                                connection.query(query, (err, rows, fields) => {
                                    const customProducts = cart.filter(product => product.pid===constants.CUSTOMIZED_ID);
                                    const userOrderLines = rows;
                                    // if length of retrieved order lines different from previously inserted order lines 
                                    if(err || userOrderLines.length !== customProducts.length){
                                        connection.rollback(() => {
                                            connection.release();
                                        });
                                        return res.status(500).send('Database error. ' + err);
                                    }
                                    else{
                                        // query to insert flavors
                                        query = 'INSERT INTO Customized_Flavors (uolid, fid) VALUES';            
                                        const insertedFlavors = [];
                                        // add flavors to query
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
                                        // if no flavors, commit transaction
                                        if (insertedFlavors.length===0){

                                            connection.commit((err) => {
                                                if (err) {
                                                    return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                                }
                                                connection.release();
                                                return res.status(200).send('Order completed.');
                                            });
                                       
                                        } else {
                                            // execute query
                                            connection.query(query, (err, rows, fields) => {
                                                if (err){                                                    
                                                    connection.rollback(() => {
                                                        connection.release();
                                                    });
                                                    return res.status(500).send('Database error. ' + err);
                                                } 
                                                // commit transaction
                                                else{
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

// format user orders
function formatUserOrders(orders){
    const userOrders = {};

    orders.forEach(order => {
        // add order fields
        if (!(order.uoid in userOrders)) {
            userOrders[order.uoid] = 
                {uoid:order.uoid, 
                uid:order.uid, 
                firstname:order.firstname,
                lastname:order.lastname,
                date_time: order.date_time, 
                total_price: order.total_price,
                del_address: order.del_address,
                phone_number: order.phone_number,
                cc_number: order.cc_number,
                cc_expdate: order.cc_expdate,
                status: order.status,
                order_lines: {}};
        }
        // add order line fields
        if(!(order.uolid in userOrders[order.uoid].order_lines)) {
            userOrders[order.uoid].order_lines[order.uolid] =
                {uolid: order.uolid,
                pid: order.pid,
                amount: order.amount,
                price: order.price,
                name: order.productName,
                image: order.image,
                flavors: []};
        }
        // add flavor fields
        if (order.fid) {
            userOrders[order.uoid].order_lines[order.uolid].flavors.push({
                fid: order.fid,
                name: order.flavorName,
            });
        }
    });
    return userOrders;
}

// status put validator
function validateStatusPut(status){
    const schema = {
        status: Joi.string().valid("Cancelled", "Open", "Processed").required()
    }
    return Joi.validate(status, schema);
}

// post validator
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
        del_address: Joi.string().max(256).required(),
        phone_number: Joi.string().max(32).required()
    }
    return Joi.validate(order, schema);
}


module.exports = router;