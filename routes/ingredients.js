const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authEmployeeToken = require('../middlewares/authEmployeeToken');
const sqlconn = require('../helpers/sqlconn');
const _ = require('lodash');

// get all ingredients
router.get('/', (req, res) => {

    query = 'SELECT * FROM Ingredients';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send('Unable to get ingredients. ' + err);
        return res.status(200).send(rows);
    });
});

// get ingredient based on id
router.get('/:id', (req, res) => {
    const iid = req.params.id;

    query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);

    sqlconn.query(query, function (err, rows, fields) {
        const ingredient = rows[0];
        if (!ingredient) return res.status(404).send('Ingredient with the given ID was not found.');
        res.status(200).send(ingredient);
    });
});

// post ingredient
router.post('/', authEmployeeToken, (req, res) => {
    // validate body
    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message)

    const ingredient = {
        name: req.body.name,
        vendor: req.body.vendor
    }

    // query to insert ingredient
    query = 'INSERT INTO Ingredients (name, vendor) \
            VALUES (' + 
            sqlconn.escape(ingredient.name) + ',' + 
            sqlconn.escape(ingredient.vendor) + '); \
            SELECT LAST_INSERT_ID();';

    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to insert.' + err);
        
        const iid = rows[0].insertId;

        // query to get inserted ingredient
        query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);
        // execute query
        sqlconn.query(query, function (err, rows, fields) {
            const ingredient = rows[0];
            return res.status(200).send(ingredient);
        });
    });
});


router.put('/:id', authEmployeeToken, (req, res) => {
    // validate body
    const { error } = validatePut(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const iid = req.params.id;

    updatedIngredient = _.pick(req.body, ['name', 'vendor']);

    // query to check if ingredient exist
    query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);

    let ingredient;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to update.' + err);

        ingredient = rows[0];
        if (!ingredient) return res.status(400).send('Ingredient does not exist.');
        
        // if body does not include a field, take its current value in the database
        if (updatedIngredient.name == null) updatedIngredient.name = ingredient.name;
        if (updatedIngredient.vendor == null) updatedIngredient.vendor = ingredient.vendor;

        query = 'UPDATE Ingredients SET\
                name='+ sqlconn.escape(updatedIngredient.name) +
                ',vendor=' + sqlconn.escape(updatedIngredient.vendor) +
                ' WHERE iid=' + sqlconn.escape(iid);

        sqlconn.query(query, function (err, rows, fields) {
            if (err) return res.status(500).send('Unable to update.' + err);

            // query to get updated ingredient
            query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);
            
            sqlconn.query(query, function (err, rows, fields) {
                ingredient = rows[0];
                return res.status(200).send(ingredient);
            });
        });
    });
});

// post validator
function validatePost(ingredient) {
    const schema = {
        name: Joi.string().max(64).required(),
        vendor: Joi.string().allow(null)
    }
    return Joi.validate(ingredient, schema);
}

// put validator
function validatePut(ingredient) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        vendor: Joi.string().allow(null)
    }
    return Joi.validate(ingredient, schema);
}

module.exports = router;