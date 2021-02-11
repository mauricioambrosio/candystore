const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authEmployeeToken = require('../middlewares/authEmployeeToken');
const sqlconn = require('../helpers/sqlconn');
const ingredientsExist = require('../helpers/ingredientsExist');

const _ = require('lodash');

router.get('/', (req, res) => {

    query = 'SELECT * FROM Products';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send('Unable to get products. ' + err);
        return res.status(200).send(rows);
    });
});

router.get('/:id', (req, res) => {
    const pid = req.params.id;

    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    sqlconn.query(query, function (err, rows, fields) {
        const product = rows[0];
        if (!product) return res.status(404).send('Product with the given ID was not found.');
        res.status(200).send(product);
    });
});

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

router.post('/ingredients/:id', authEmployeeToken, async (req, res) => {

    const { error } = validateIngredientPost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const pid = req.params.id;
    const ingredients = req.body.list

    let query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
    let product;
    sqlconn.query(query, (err, rows, fields)=> {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
    });

    const ingredientsAreValid = await ingredientsExist(ingredients);

    if (!ingredientsAreValid) return res.status(400).send('Invalid ingredients.')

    sqlconn.getConnection((err, connection)=>{
        connection.beginTransaction((err)=>{
            if(err){
                connection.rollback(()=>{
                    connection.release();
                });
                return res.status(500).send('Database error. ' + err);
            }
            else{
            
                query = 'DELETE FROM Ingredients_Products WHERE pid =' + connection.escape(pid);
                connection.query(query, (err, rows, fields)=> {
                    if (err) {
                        connection.rollback(() => {
                            connection.release();
                        });
                        return res.status(500).send('Database error. ' + err);
                    }
                    else {

                        if (ingredients.length < 1) {
                            connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                }
                                return res.status(200).send('Ingredients updated.');
                            });
                        } else {
                            query = 'INSERT INTO Ingredients_Products (pid, iid) VALUES ';

                            for (i = 0; i < ingredients.length; i++) {
                                query += '(' + connection.escape(pid) + ',' + connection.escape(ingredients[i]) + ')'

                                if (i === ingredients.length - 1) query += ';';
                                else query += ',';
                            }
                            connection.query(query, (err, rows, fields) => {
                                if (err) {
                                    connection.rollback(() => {
                                        connection.release();
                                    });
                                    return res.status(500).send('Database error. ' + err);
                                }

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



//Include ingredients
router.post('/', authEmployeeToken, (req, res) => {
    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const product = {
        name: req.body.name,
        price: req.body.price
    }

    query = 'INSERT INTO Products (name,price) \
            VALUES ('+
            sqlconn.escape(product.name) + ',' +
            sqlconn.escape(product.price) + '); \
            SELECT LAST_INSERT_ID();';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to insert.' + err);
        
        const pid = rows[0].insertId;
        query = 'SELECT * FROM Products WHERE pid = ' + sqlconn.escape(pid);
        
        sqlconn.query(query, function (err, rows, fields) {
            const product = rows[0];
            return res.status(200).send(product);
        });
    });
});


router.put('/:id', authEmployeeToken, (req, res) => {

    const { error } = validatePut(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const pid = req.params.id;

    updatedProduct = _.pick(req.body, ['name', 'price']);

    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    var product;
    sqlconn.query(query, function (err, rows, fields) {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
        else  {
            if (updatedProduct.name == null) updatedProduct.name = product.name;
            if (updatedProduct.price == null) updatedProduct.price = product.price;

            query = 'UPDATE Products SET\
                    name='+ sqlconn.escape(updatedProduct.name) +
                    ',price=' + sqlconn.escape(updatedProduct.price) +
                    ' WHERE pid=' + sqlconn.escape(pid);

            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);

                query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
                
                sqlconn.query(query, function (err, rows, fields) {
                    product = rows[0];
                    return res.status(200).send(product);
                });
            });
        }
    });
});

function validateIngredientPost(ingredients) {
    const schema = {
        list: Joi.array().items(Joi.number()).required()
    }
    return Joi.validate(ingredients, schema);
}

//Include ingredients
function validatePost(product) {
    const schema = {
        name: Joi.string().max(64).required(),
        price: Joi.number(),
    }
    return Joi.validate(product, schema);
}

function validatePut(product) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        price: Joi.number().allow(null)
    }
    return Joi.validate(product, schema);
}

module.exports = router;