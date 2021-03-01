const express = require('express');
const router = express.Router();
const authAdminToken = require('../middlewares/authAdminToken');
const sqlconn = require('../helpers/sqlconn');

const authEmployeeToken = require('../middlewares/authEmployeeToken');

const _ = require('lodash');

router.get('/', authEmployeeToken, (req, res) => {

    query = "SELECT SUM(User_Orders.total_price) as total_revenue, COUNT(User_Orders.uoid) \
            as n_orders, AVG(User_Orders.total_price) as average_order FROM User_Orders \
            WHERE status != 'Cancelled'; ";

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get stats.' + err);

        stats = rows[0];

        query = "SELECT Products.pid, Products.name, Products.price, COUNT(User_Order_Lines.uolid) as n_sold\
                FROM Products INNER JOIN User_Order_Lines ON Products.pid = User_Order_Lines.pid \
                INNER JOIN User_Orders ON User_Order_Lines.uoid = User_Orders.uoid \
                WHERE status != 'Cancelled' GROUP BY Products.pid; ";

        sqlconn.query(query, (err, rows, fields) => {
            if (err) return res.status(404).send('Unable to get stats.' + err);
            stats.products = rows;

            query = "SELECT Flavors.fid, Flavors.name, Flavors.price, COUNT(Customized_Flavors.cfid) as n_sold \
                    FROM Flavors INNER JOIN Customized_Flavors ON Flavors.fid = Customized_Flavors.fid \
                    INNER JOIN User_Order_Lines ON Customized_Flavors.uolid = User_Order_Lines.uolid \
                    INNER JOIN User_Orders ON User_Order_Lines.uoid = User_Orders.uoid \
                    WHERE status != 'Cancelled' GROUP BY Flavors.fid; ";

            sqlconn.query(query, (err, rows, fields) => {
                if (err) return res.status(404).send('Unable to get stats.' + err);
                stats.flavors = rows;

                query = "SELECT COUNT(*) as count, SUM(total_price) as total_price, \
                        DATE_FORMAT(date_time, '%Y-%m-%d') AS date FROM User_Orders \
                        WHERE DATEDIFF(NOW(), DATE(date_time)) < 31 AND status != 'Cancelled'\
                        GROUP BY DATE_FORMAT(date_time, '%Y-%m-%d')";

                sqlconn.query(query, (err, rows, fields) => {
                    if (err) return res.status(404).send('Unable to get stats.' + err);
                    stats.orders_month = rows;

                    query = "SELECT COUNT(*) as count, SUM(total_price) as total_price, \
                            DATE_FORMAT(date_time, '%Y-%m') AS date FROM User_Orders \
                            WHERE DATEDIFF(NOW(), DATE(date_time)) < 366 AND status != 'Cancelled'\
                            GROUP BY DATE_FORMAT(date_time, '%Y-%m')";

                    sqlconn.query(query, (err, rows, fields) => {
                        if (err) return res.status(404).send('Unable to get stats.' + err);
                        stats.orders_year = rows;

                        return res.status(200).send(stats);
                
                    });
                });
            });
        });
    });
});

router.get('/products', authEmployeeToken, (req, res) => {

    query = 'SELECT Products.pid, Products.name, Products.price, \
            COUNT(User_Order_Lines.uolid) as n_sold\
            FROM Products INNER JOIN User_Order_Lines \
            ON Products.pid = User_Order_Lines.pid GROUP BY Products.pid; ';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get stats.' + err);
        return res.status(200).send(rows);
    });
});

router.get('/flavors', authEmployeeToken, (req, res) => {

    query = 'SELECT Flavors.fid, Flavors.name, Flavors.price, \
            COUNT(Customized_Flavors.cfid) as n_sold \
            FROM Flavors INNER JOIN Customized_Flavors \
            ON Flavors.fid = Customized_Flavors.fid GROUP BY Flavors.fid; ';

    sqlconn.query(query, (err, rows, fields) => {
        if (err) return res.status(404).send('Unable to get stats.' + err);
        return res.status(200).send(rows);
    });
});

module.exports = router;