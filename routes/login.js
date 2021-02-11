const _ = require('lodash');
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const sqlconn = require('../helpers/sqlconn');
const genToken = require('../helpers/genToken');

router.post('/c', async (req, res) => {
    
    const { error } = validatePost(req.body); //result.error    
    if (error) return res.status(400).send('Invalid email or password.');

    loginReq = _.pick(req.body, ['email', 'password']);

    var user;
    query = 'SELECT * FROM Users WHERE email=' + sqlconn.escape(loginReq.email);
    sqlconn.query(query, function (err, rows, fields) {

        if ((err) || (rows.length == 0)) return res.status(400).send('Invalid email or password.');
        else {
            user = rows[0];
            advance();
        }
    });


    async function advance() {
        const validPassword = await bcrypt.compare(loginReq.password, user.password);
        if (!validPassword) return res.status(400).send('Invalid email or password.');

        const token = genToken(user, "user");
        res.send({ token: token, rid: -1 });
    }
});

router.post('/e', async (req, res) => {

    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send('Invalid email or password.');

    loginReq = _.pick(req.body, ['email', 'password']);

    var employee;
    query = 'SELECT * FROM Employees WHERE email=' + sqlconn.escape(loginReq.email);
    sqlconn.query(query, function (err, rows, fields) {
        if ((err) || (rows.length == 0)) return res.status(400).send('Invalid email or password.');
        else {
            employee = rows[0];
            advance();
        }
    });


    async function advance() {
        const validPassword = await bcrypt.compare(loginReq.password, employee.password);
        if (!validPassword) return res.status(400).send('Invalid email or password.');

        const token = genToken(employee, "employee");
        return res.send({ token: token, rid: employee.rid });
    }
});


function validatePost(req) {
    const schema = {
        email: Joi.string().max(64).email().required(),
        password: Joi.string().max(64).required()
    };
    return Joi.validate(req, schema);
}


module.exports = router;