const express = require("express");
const router = express.Router();
const Joi = require("joi");
const authEmployeeToken = require("../middlewares/authEmployeeToken");
const sqlconn = require("../helpers/sqlconn");
const ingredientsExist = require('../helpers/ingredientsExist');

const _ = require("lodash");

// get all flavors
router.get("/", (req, res) => {
    query = "SELECT * FROM Flavors";

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send("Unable to get flavors. " + err);
        return res.status(200).send(rows);
    });
});

// get flavor based on id
router.get("/:id", (req, res) => {
    const fid = req.params.id;

    query = "SELECT * FROM Flavors WHERE fid=" + sqlconn.escape(fid);

    sqlconn.query(query, function (err, rows, fields) {
        const flavor = rows[0];
        if (!flavor)
            return res.status(404).send("Flavor with the given ID was not found.");
        res.status(200).send(flavor);
    });
});

// get ingredients in flavor based on flavor id
router.get('/ingredients/:id', (req, res) => {
    const fid = req.params.id;

    query = 'SELECT *, Flavors.name as fname FROM Flavors INNER JOIN Ingredients_Flavors ON \
    Flavors.fid = Ingredients_Flavors.fid INNER JOIN Ingredients ON \
    Ingredients_Flavors.iid = Ingredients.iid WHERE Flavors.fid=' + sqlconn.escape(fid);

    sqlconn.query(query, function (err, rows, fields) {
        const ingredietsInFlavor = rows;
        if (!ingredietsInFlavor) return res.status(404).send('Ingredients in Flavor with the given ID were not found.');
        res.status(200).send(ingredietsInFlavor);
    });
});

// remove existing ingredients and add new ingredients for flavor 
router.post('/ingredients/:id', authEmployeeToken, async (req, res) => {

    // validate body
    const { error } = validateIngredientPost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const fid = req.params.id;
    const ingredients = req.body.list

    // query to check if flavor exist
    let query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);
    let flavor;

    // execute query
    sqlconn.query(query, (err, rows, fields)=> {
        flavor = rows[0];
        if (!flavor) return res.status(400).send('Flavor does not exist.');
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
                // query to delete existing ingredients in flavor
                query = 'DELETE FROM Ingredients_Flavors WHERE fid =' + connection.escape(fid);
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
                            query = 'INSERT INTO Ingredients_Flavors (fid, iid) VALUES ';
                            // add ingredients to query
                            for (i = 0; i < ingredients.length; i++) {
                                query += '(' + connection.escape(fid) + ',' + connection.escape(ingredients[i]) + ')'

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
    const fid = req.params.id;
    // query to check if flavor exist
    query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        flavor = rows[0];
        if (!flavor) return res.status(400).send('Flavor does not exist.');
        
        else {
            // update flavor active value to 1
            query = 'UPDATE Flavors SET \
                    active = 1 WHERE fid=' + sqlconn.escape(fid);

            // execute query
            sqlconn.query(query, (err, rows, fields) => {
                if (err) return res.status(500).send('Unable to update.' + err);

                // query to get updated flavor
                query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);
                
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    flavor = rows[0];
                    return res.status(200).send(flavor);
                });
            });
        }
    }); 
});

// delete flavor by changing it's active value to 0
router.delete('/:id', authEmployeeToken, (req, res) => {
    const fid = req.params.id;
    // query to check if flavor exist
    query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);

    // execute query
    sqlconn.query(query, (err, rows, fields) => {
        flavor = rows[0];
        if (!flavor) return res.status(400).send('Flavor does not exist.');
        
        else {
            // update flavor active value to 0
            query = 'UPDATE Flavors SET \
                    active = 0 WHERE fid=' + sqlconn.escape(fid);
            
            // execute query
            sqlconn.query(query, (err, rows, fields) => {
                if (err) return res.status(500).send('Unable to update.' + err);
                // query to get updated flavor
                query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);
                
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    flavor = rows[0];
                    return res.status(200).send(flavor);
                });
            });
        }
    });
});


// post flavor
router.post("/", authEmployeeToken, (req, res) => {
    // validate body
    const { error } = validatePost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const flavor = {
        name: req.body.name,
        price: req.body.price
    };

    // query to insert flavor
    query = 'INSERT INTO Flavors (name,price) \
            VALUES (' +
            sqlconn.escape(flavor.name) + ',' +
            sqlconn.escape(flavor.price) + '); \
            SELECT LAST_INSERT_ID();';

    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send("Unable to insert." + err);
        
        const fid = rows[0].insertId;

        // query to get inserted flavor
        query = 'SELECT * FROM Flavors WHERE fid = ' + sqlconn.escape(fid);
        // execute query
        sqlconn.query(query, function (err, rows, fields) {
            const flavor = rows[0];
            return res.status(200).send(flavor);
        });
    });
});


router.put("/:id", authEmployeeToken, async (req, res) => {
    // validate body
    const { error } = validatePut(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const fid = req.params.id;

    updatedFlavor = _.pick(req.body, ["name", "price"]);

    // query to check if flavor exist
    query = "SELECT * FROM Flavors WHERE fid=" + sqlconn.escape(fid);

    let flavor;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        flavor = rows[0];
        if (!flavor) return res.status(400).send("Flavor does not exist.");

        else  {
            // if body does not include a field, take its current value in the database
            if (updatedFlavor.name == null) updatedFlavor.name = flavor.name;
            if (updatedFlavor.price == null) updatedFlavor.price = flavor.price;

            query = "UPDATE Flavors SET\
                    name=" + sqlconn.escape(updatedFlavor.name) +
                    ",price=" + sqlconn.escape(updatedFlavor.price) +
                    " WHERE fid=" + sqlconn.escape(fid);

            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);
                
                // query to get updated flavor
                query = "SELECT * FROM Flavors WHERE fid=" + sqlconn.escape(fid);

                sqlconn.query(query, function (err, rows, fields) {
                    flavor = rows[0];
                    return res.status(200).send(flavor);
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
function validatePost(flavor) {
    const schema = {
        name: Joi.string().max(64).required(),
        price: Joi.number()
    };
    return Joi.validate(flavor, schema);
}

// put validator
function validatePut(flavor) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        price: Joi.number().allow(null)
    };
    return Joi.validate(flavor, schema);
}

module.exports = router;
