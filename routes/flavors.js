const express = require("express");
const router = express.Router();
const Joi = require("joi");
const authEmployeeToken = require("../middlewares/authEmployeeToken");
const sqlconn = require("../helpers/sqlconn");
const ingredientsExist = require('../helpers/ingredientsExist');

const _ = require("lodash");

router.get("/", (req, res) => {
    query = "SELECT * FROM Flavors";

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(404).send("Unable to get flavors. " + err);
        return res.status(200).send(rows);
    });
});

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

router.post('/ingredients/:id', authEmployeeToken, async (req, res) => {

    const { error } = validateIngredientPost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const fid = req.params.id;
    const ingredients = req.body.list

    let query = 'SELECT * FROM Flavors WHERE fid=' + sqlconn.escape(fid);
    let flavor;
    sqlconn.query(query, (err, rows, fields)=> {
        flavor = rows[0];
        if (!flavor) return res.status(400).send('Flavor does not exist.');
    });

    const ingredientsAreValid = await ingredientsExist(ingredients);

    if (!ingredientsAreValid) return res.status(400).send('Invalid ingredients.')

    sqlconn.getConnection((err, connection)=>{
        connection.beginTransaction((err)=>{
            if(err){
                console.log("LEVEL 0", err);
                connection.rollback(()=>{
                    connection.release();
                });
                return res.status(500).send('Database error. ' + err);
            }
            else{
            
                query = 'DELETE FROM Ingredients_Flavors WHERE fid =' + connection.escape(fid);
                connection.query(query, (err, rows, fields)=> {
                    if (err) {
                        console.log("LEVEL 1", err);
                        connection.rollback(() => {
                            connection.release();
                        });
                        return res.status(500).send('Database error. ' + err);
                    }
                    else {

                        if (ingredients.length < 1) {
                            connection.commit((err) => {
                                if (err) {
                                    console.log("LEVEL 2", err);
                                    return connection.rollback(() => res.status(500).send('Database error. ' + err));
                                }
                                return res.status(200).send('Ingredients updated.');
                            });
                        } else {
                            query = 'INSERT INTO Ingredients_Flavors (fid, iid) VALUES ';

                            for (i = 0; i < ingredients.length; i++) {
                                query += '(' + connection.escape(fid) + ',' + connection.escape(ingredients[i]) + ')'

                                if (i === ingredients.length - 1) query += ';';
                                else query += ',';
                            }
                            connection.query(query, (err, rows, fields) => {
                                if (err) {
                                    console.log("LEVEL 3", err);
                                    connection.rollback(() => {
                                        connection.release();
                                    });
                                    return res.status(500).send('Database error. ' + err);
                                }

                                connection.commit((err) => {
                                    if (err) {
                                        console.log("LEVEL 4", err);
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
router.post("/", authEmployeeToken, (req, res) => {
    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const flavor = {
        name: req.body.name,
        price: req.body.price
    };

    query = 'INSERT INTO Flavors (name,price) \
            VALUES (' +
            sqlconn.escape(flavor.name) + ',' +
            sqlconn.escape(flavor.price) + '); \
            SELECT LAST_INSERT_ID();';

    sqlconn.query(query, function (err, rows, fields) {
        if (err) return res.status(500).send("Unable to insert." + err);
        
        const fid = rows[0].insertId;
        query = 'SELECT * FROM Flavors WHERE fid = ' + sqlconn.escape(fid);
        
        sqlconn.query(query, function (err, rows, fields) {
            const flavor = rows[0];
            return res.status(200).send(flavor);
        });
    });
});

router.put("/:id", authEmployeeToken, async (req, res) => {
    
    const { error } = validatePut(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const fid = req.params.id;

    updatedFlavor = _.pick(req.body, ["name", "price"]);

    query = "SELECT * FROM Flavors WHERE fid=" + sqlconn.escape(fid);

    var flavor;
    sqlconn.query(query, function (err, rows, fields) {
        flavor = rows[0];
        if (!flavor) return res.status(400).send("Flavor does not exist.");

        else  {
            if (updatedFlavor.name == null) updatedFlavor.name = flavor.name;
            if (updatedFlavor.price == null) updatedFlavor.price = flavor.price;

            query = "UPDATE Flavors SET\
                    name=" + sqlconn.escape(updatedFlavor.name) +
                    ",price=" + sqlconn.escape(updatedFlavor.price) +
                    " WHERE fid=" + sqlconn.escape(fid);

            sqlconn.query(query, function (err, rows, fields) {
                if (err) return res.status(500).send('Unable to update.' + err);

                query = "SELECT * FROM Flavors WHERE fid=" + sqlconn.escape(fid);

                sqlconn.query(query, function (err, rows, fields) {
                    flavor = rows[0];
                    return res.status(200).send(flavor);
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
function validatePost(flavor) {
    const schema = {
        name: Joi.string().max(64).required(),
        price: Joi.number()
    };
    return Joi.validate(flavor, schema);
}

function validatePut(flavor) {
    const schema = {
        name: Joi.string().max(64).allow(null),
        price: Joi.number().allow(null)
    };
    return Joi.validate(flavor, schema);
}

module.exports = router;
