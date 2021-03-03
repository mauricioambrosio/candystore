const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authEmployeeToken = require('../middlewares/authEmployeeToken');
const sqlconn = require('../helpers/sqlconn');
const ingredientsExist = require('../helpers/ingredientsExist');

const _ = require('lodash');

// get all products
router.get('/', (req, res) => {
    query = 'SELECT * FROM Products';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send('Unable to get products. ' + err);
        return res.status(200).send(rows);
    });
});

// get product based on id
router.get('/:id', (req, res) => {
    const pid = req.params.id;

    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    sqlconn.query(query, function (err, rows, fields) {
        const product = rows[0];
        if (!product) return res.status(404).send('Product with the given ID was not found.');
        res.status(200).send(product);
    });
});

// get ingredients in product based on product id
router.get('/ingredients/:id', (req, res) => {
    const pid = req.params.id;

    query = 'SELECT *, Products.name as pname FROM Products INNER JOIN Ingredients_Products ON \
    Products.pid = Ingredients_Products.pid INNER JOIN Ingredients ON \
    Ingredients_Products.iid = Ingredients.iid WHERE Products.pid=' + sqlconn.escape(pid);

    sqlconn.query(query, function (err, rows, fields) {
        const ingredietsInProduct = rows;
        if (!ingredietsInProduct) return res.status(404).send('Ingredients in product with the given ID were not found.');
        res.status(200).send(ingredietsInProduct);
    });
});

// remove existing ingredients and add new ingredients for product
router.post('/ingredients/:id', authEmployeeToken, async (req, res) => {

    // validate body
    const { error } = validateIngredientPost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const pid = req.params.id;
    const ingredients = req.body.list

    // query to check if product exist
    let query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
    let product;

    // execute query
    sqlconn.query(query, (err, rows, fields)=> {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
    });

    // check if ingredients exist
    const ingredientsAreValid = await ingredientsExist(ingredients);
    if (!ingredientsAreValid) return res.status(400).send('Invalid ingredients.')

    // get a connection from connection pool
    sqlconn.getConnection((err, connection)=>{
        // start transaction
        connection.beginTransaction((err)=>{
            if(err){
                connection.rollback(()=>{
                    connection.release();
                });
                return res.status(500).send('Database error. ' + err);
            }
            else{
                // query to delete existing ingredients in product
                query = 'DELETE FROM Ingredients_Products WHERE pid =' + connection.escape(pid);
                // exectue query
                connection.query(query, (err, rows, fields)=> {
                    if (err) {
                        connection.rollback(() => {
                            connection.release();
                        });
                        return res.status(500).send('Database error. ' + err);
                    }
                    else {
                        // if no ingredients to add, commit
                        if (ingredients.length < 1) {
                            // commit transaction
                            connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                }
                                return res.status(200).send('Ingredients updated.');
                            });
                        } 
                        // if there are ingredients to add
                        else {
                            // query to insert new ingredients
                            query = 'INSERT INTO Ingredients_Products (pid, iid) VALUES ';
                            // add ingredients to query
                            for (i = 0; i < ingredients.length; i++) {
                                query += '(' + connection.escape(pid) + ',' + connection.escape(ingredients[i]) + ')'

                                if (i === ingredients.length - 1) query += ';';
                                else query += ',';
                            }
                            // execute query
                            connection.query(query, (err, rows, fields) => {
                                if (err) {
                                    connection.rollback(() => {
                                        connection.release();
                                    });
                                    return res.status(500).send('Database error. ' + err);
                                }
                                // commit transaction
                                connection.commit((err) => {
                                    if (err) {
                                        return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                    }
                                    connection.release();
                                    return res.status(200).send('Ingredients updated.');
                                });
                            });
                        }
                    }
                });
            }
        });
    });
});

// restore flavor by changing it's active value to 1
router.post('/:id', authEmployeeToken, (req, res) => {
    const pid = req.params.id;
    // query to check if flavor exist
    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
        
        else {
            // update product active value to 1
            query = 'UPDATE Products SET \
                    active = 1 WHERE pid=' + sqlconn.escape(pid);
            // execute query
            sqlconn.query(query, (err, rows, fields) => {
                if (err) return res.status(500).send('Unable to update.' + err);

                // query to get updated product
                query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
                
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    product = rows[0];
                    return res.status(200).send(product);
                });
            })
        }
    }); 
});

// delete product by changing it's active value to 0
router.delete('/:id', authEmployeeToken, (req, res) => {
    const pid = req.params.id;
    // query to check if product exist
    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
        
        else {
            // update product active value to 0
            query = 'UPDATE Products SET \
                    active = 0 WHERE pid=' + sqlconn.escape(pid);
            
            // execute query
            sqlconn.query(query, (err, rows, fields) => {
                if (err) return res.status(500).send('Unable to update.' + err);

                // query to get updated product
                query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
                
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    product = rows[0];
                    return res.status(200).send(product);
                });
            })
        }
    });
});


// post product
router.post('/', authEmployeeToken, (req, res) => {
    // validate body
    const { error } = validatePost(req.body); 
    if (error) return res.status(400).send(error.details[0].message);

    const product = {
        name: req.body.name,
        price: req.body.price
    }

    // query to insert product
    query = 'INSERT INTO Products (name,price) \
            VALUES ('+
            sqlconn.escape(product.name) + ',' +
            sqlconn.escape(product.price) + '); \
            SELECT LAST_INSERT_ID();';

    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to insert.' + err);
        
        const pid = rows[0].insertId;
        
        // query to get inserted product
        query = 'SELECT * FROM Products WHERE pid = ' + sqlconn.escape(pid);
        // execute query
        sqlconn.query(query, function (err, rows, fields) {
            const product = rows[0];
            return res.status(200).send(product);
        });
    });
});

router.put('/:id', authEmployeeToken, (req, res) => {
    // validate body
    const { error } = validatePut(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const pid = req.params.id;

    updatedProduct = _.pick(req.body, ['name', 'price']);

    // query to check if flavor exist
    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    let product;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
        
        else  {
            // if body does not include a field, take its current value in the database
            if (updatedProduct.name == null) updatedProduct.name = product.name;
            if (updatedProduct.price == null) updatedProduct.price = product.price;

            query = 'UPDATE Products SET\
                    name=' + sqlconn.escape(updatedProduct.name) +
                    ',price=' + sqlconn.escape(updatedProduct.price) +
                    ' WHERE pid=' + sqlconn.escape(pid);

            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);

                // query to get updated product
                query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
                
                sqlconn.query(query, function (err, rows, fields) {
                    product = rows[0];
                    return res.status(200).send(product);
                });
            });
        }
    });
});

// ingredient post validator
function validateIngredientPost(ingredients) {
    const schema = {
        list: Joi.array().items(Joi.number()).required()
    }
    return Joi.validate(ingredients, schema);
}

// post validator
function validatePost(product) {
    const schema = {
        name: Joi.string().max(64).required(),
        price: Joi.number(),
    }
    return Joi.validate(product, schema);
}

// put validator
function validatePut(product) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        price: Joi.number().allow(null)
    }
    return Joi.validate(product, schema);
}

module.exports = router;