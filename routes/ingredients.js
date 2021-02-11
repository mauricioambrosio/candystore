const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authEmployeeToken = require('../middlewares/authEmployeeToken');
const sqlconn = require('../helpers/sqlconn');
const _ = require('lodash');

router.get('/', (req, res) => {

    query = 'SELECT * FROM Ingredients';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send('Unable to get ingredients. ' + err);
        return res.status(200).send(rows);
    });
});

router.get('/:id', (req, res) => {
    const iid = req.params.id;

    query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);

    sqlconn.query(query, function (err, rows, fields) {
        const ingredient = rows[0];
        if (!ingredient) return res.status(404).send('Ingredient with the given ID was not found.');
        res.status(200).send(ingredient);
    });
});

router.post('/', authEmployeeToken, (req, res) => {

    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message)

    const ingredient = {
        name: req.body.name,
        vendor: req.body.vendor
    }

    query = 'INSERT INTO Ingredients (name, vendor) \
            VALUES (' + 
            sqlconn.escape(ingredient.name) + ',' + 
            sqlconn.escape(ingredient.vendor) + '); \
            SELECT LAST_INSERT_ID();';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to insert.' + err);
        
        const iid = rows[0].insertId;
        query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);

        sqlconn.query(query, function (err, rows, fields) {
            const ingredient = rows[0];
            return res.status(200).send(ingredient);
        });
    });
});


router.put('/:id', authEmployeeToken, (req, res) => {

    const { error } = validatePut(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const iid = req.params.id;

    updatedIngredient = _.pick(req.body, ['name', 'vendor']);

    query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);
    var ingredient;

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send('Unable to update.' + err);

        ingredient = rows[0];
        if (!ingredient) return res.status(400).send('Ingredient does not exist.');
        
        
        if (updatedIngredient.name == null) updatedIngredient.name = ingredient.name;
        if (updatedIngredient.vendor == null) updatedIngredient.vendor = ingredient.vendor;


        query = 'UPDATE Ingredients SET\
        name='+ sqlconn.escape(updatedIngredient.name) +
            ',vendor=' + sqlconn.escape(updatedIngredient.vendor) +
            ' WHERE iid=' + sqlconn.escape(iid);

        sqlconn.query(query, function (err, rows, fields) {
            if (err) return res.status(500).send('Unable to update.' + err);

            query = 'SELECT * FROM Ingredients WHERE iid=' + sqlconn.escape(iid);
            
            sqlconn.query(query, function (err, rows, fields) {
                ingredient = rows[0];
                return res.status(200).send(ingredient);
            });
        }); 
    });
});

function validatePost(ingredient) {
    const schema = {
        name: Joi.string().max(64).required(),
        vendor: Joi.string().allow(null)
    }
    return Joi.validate(ingredient, schema);
}

function validatePut(ingredient) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        vendor: Joi.string().allow(null)
    }
    return Joi.validate(ingredient, schema);
}

module.exports = router;