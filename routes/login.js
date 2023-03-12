const _ = require('lodash');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const sqlconn = require('../helpers/sqlconn');
const genToken = require('../helpers/genToken');

// login customer
router.post('/c', async (req, res) => {
    // validate post
    const { error } = validatePost(req.body);    
    if (error) return res.status(400).send('Invalid email or password.');

    loginReq = _.pick(req.body, ['email', 'password']);

    let user;
    // query to check if email exists
    query = 'SELECT * FROM Users WHERE email=' + sqlconn.escape(loginReq.email);
    // execute query
    sqlconn.query(query, async (err, rows, fields) => {
        // if email does not exist
        if ((err) || (rows.length === 0)) return res.status(400).send('Invalid email or password.');
        else {
            user = rows[0];
            // check if hash of provided password is the same as stored password hash
            const validPassword = await bcrypt.compare(loginReq.password, user.password);
            // if password is not valid
            if (!validPassword) return res.status(400).send('Invalid email or password.');
            // generate and send json web token
            const token = genToken(user, "user");
            return res.send({ token: token, rid: -1 });
        }
    });
});

// login employee
router.post('/e', async (req, res) => {
    // validate post
    const { error } = validatePost(req.body);
    if (error) return res.status(400).send('Invalid email or password.');

    loginReq = _.pick(req.body, ['email', 'password']);

    let employee;
    // query to check if email exists
    query = 'SELECT * FROM Employees WHERE email=' + sqlconn.escape(loginReq.email);
    // execute query
    sqlconn.query(query, async (err, rows, fields) => {
        // if email does not exist
        if ((err) || (rows.length === 0)) return res.status(400).send('Invalid email or password.');
        else {
            employee = rows[0];
            // check if hash of provided password is the same as stored password hash
            const validPassword = await bcrypt.compare(loginReq.password, employee.password);
            // if password is not valid
            if (!validPassword) return res.status(400).send('Invalid email or password.');
            // generate and send json web token
            const token = genToken(employee, "employee");
            return res.send({ token: token, rid: employee.rid });
        }
    });
});

// post validator
function validatePost(req) {
    const schema = {
        email: Joi.string().max(64).email().required(),
        password: Joi.string().max(64).required()
    };
    return Joi.validate(req, schema);
}

module.exports = router;