const moment = require('moment');
const authUserToken = require('../middlewares/authUserToken');
const authAdminToken = require('../middlewares/authAdminToken');
const authEmployeeToken = require('../middlewares/authEmployeeToken');
const {userEmailExists} = require('../helpers/emailExists');

const constants = require('../helpers/constants');

const _ = require('lodash');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const sqlconn = require('../helpers/sqlconn');
const genToken = require('../helpers/genToken');
const emailExists = require('../helpers/emailExists');

router.post('/', async (req, res) => {
    // validate body
    const { error } = validatePost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    newUser = _.pick(req.body, ['email', 'password', 'firstname', 'lastname']);

    if (await userEmailExists(newUser.email))
        return res.status(400).send('Email already being used.');
    else {
        // generate salt for password hash
        const salt = await bcrypt.genSalt(10);
        // hash password
        newUser.password = await bcrypt.hash(newUser.password, salt);
        const created_at = moment().format('YYYY-MM-DD').toString();

        // query to insert user
        query = 'INSERT INTO Users (email,password,firstname,lastname,created_at) \
            VALUES ('+ sqlconn.escape(newUser.email) + ','
            + sqlconn.escape(newUser.password) + ','
            + sqlconn.escape(newUser.firstname) + ','
            + sqlconn.escape(newUser.lastname) + ','
            + sqlconn.escape(created_at) + ')';

        // execute query
        sqlconn.query(query, function (err, rows, fields) {
            if (err) return res.status(500).send('Internal server error.');
            else {
                // query to return inserted user
                query = 'SELECT * FROM Users WHERE email=' + sqlconn.escape(newUser.email);
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    user = rows[0];
                    // generate json web token
                    const token = genToken(user, constants.USER);
                    // send user id and email with the json web tokeb as header
                    return res.status(200).header(constants.X_AUTH_TOKEN, token)
                        .header(constants.ACCESS_CONTROL_EXPOSE_HEADERS, constants.X_AUTH_TOKEN)
                        .send(_.pick(user, ['uid', 'email']));
                });
            }
        });
    }
});

// update user data
// only the user can edit his/her own data
router.put('/me', authUserToken, (req, res) => {

    // validate fields in the body
    const { error } = validatePut(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    uid = req.user.uid;
    updatedUser = _.pick(req.body, ['firstname', 'lastname', 'gender', 'birthdate', 'phone_number', 'address']);

    // query to check if the user exists
    query = 'SELECT * FROM Users WHERE uid=' + sqlconn.escape(uid);

    var user;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        user = rows[0];
        if (!user) return res.status(400).send('User has been removed.');
        
        else  {
            // if body does not include a field, take its current value in the database
            if (updatedUser.firstname === undefined) updatedUser.firstname = user.firstname;
            if (updatedUser.lastname === undefined) updatedUser.lastname = user.lastname;
            if (updatedUser.gender === undefined) updatedUser.gender = user.gender;
            if (updatedUser.birthdate === undefined) updatedUser.birthdate = user.birthdate;
            if (updatedUser.phone_number === undefined) updatedUser.phone_number = user.phone_number;
            if (updatedUser.address === undefined) updatedUser.address = user.address;

            // query to update user
            query = 'UPDATE Users SET\
                firstname=' + sqlconn.escape(updatedUser.firstname) +
                ',lastname=' + sqlconn.escape(updatedUser.lastname) +
                ',gender=' + sqlconn.escape(updatedUser.gender) +
                ',birthdate=' + sqlconn.escape(updatedUser.birthdate) +
                ',phone_number=' + sqlconn.escape(updatedUser.phone_number) +
                ',address=' + sqlconn.escape(updatedUser.address) +
                ' WHERE uid=' + sqlconn.escape(uid);

            // execute query
            sqlconn.query(query, function (err, rows, fields) {
                // query to get updated user
                query = 'SELECT *, NULL as password FROM Users WHERE uid=' + sqlconn.escape(uid);
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    // send updated user
                    const user = rows[0];
                    return res.status(200).send(user);
                });
            });
        }
    });
});

// get current authenticated user
router.get('/me', authUserToken, (req, res) => {

    query = 'SELECT *, NULL as password FROM Users WHERE uid=' + sqlconn.escape(req.user.uid);

    sqlconn.query(query, function (err, rows, fields) {
        user = rows[0];
        return res.status(200).send(user);
    });
});

// get user based on id
router.get('/:uid', authAdminToken, (req, res) => {

    query = 'SELECT *, NULL as password FROM Users WHERE uid=' + sqlconn.escape(req.params.uid);

    sqlconn.query(query, function (err, rows, fields) {
        user = rows[0];
        return res.status(200).send(user);
    });
});

// get all users
router.get('/', authEmployeeToken, (req, res) => {
    query = 'SELECT *, NULL as password FROM Users';

    sqlconn.query(query, function (err, rows, fields) {
        users = rows;
        return res.status(200).send(users);
    });
});

// post validator
function validatePost(user) {
    const schema = {
        firstname: Joi.string().min(1).max(64).required(),
        lastname: Joi.string().min(1).max(64).required(),
        email: Joi.string().min(1).max(64).email().required(),
        password: Joi.string().min(1).max(128).required()
    };

    return Joi.validate(user, schema);
}
// put validator
function validatePut(user) {
    const schema = {
        firstname: Joi.string().min(1).max(64).required(),
        lastname: Joi.string().min(1).max(64).required(),
        gender: Joi.string().valid('M', 'F').max(1).allow(null, ""),
        phone_number: Joi.string().max(32).allow(null, ""),
        birthdate: Joi.date().max(new Date().setDate(new Date().getDate() - 1)).allow(null, ""),
        address: Joi.string().max(256).allow(null, "")
    };

    return Joi.validate(user, schema);
}

module.exports = router;