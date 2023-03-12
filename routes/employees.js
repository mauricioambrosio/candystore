// employees endpoint
const moment = require('moment');
const authEmployeeToken = require('../middlewares/authEmployeeToken');
const authAdminToken = require('../middlewares/authAdminToken');
const {employeeEmailExists} = require('../helpers/emailExists');

const constants = require('../helpers/constants');

const _ = require('lodash');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const sqlconn = require('../helpers/sqlconn');
const genToken = require('../helpers/genToken');


// create employees
// only admins can post employees
router.post('/', authAdminToken, async (req, res) => {

    // validate body 
    const { error } = validatePost(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    newEmployee = _.pick(req.body, ['email', 'password', 'firstname', 'lastname']);

    if (await employeeEmailExists(newEmployee.email))
        return res.status(400).send('Email already being used.');
    else {
        // generate salt for password hash
        const salt = await bcrypt.genSalt(10);
        // hash password
        newEmployee.password = await bcrypt.hash(newEmployee.password, salt);
        const created_at = moment().format('YYYY-MM-DD').toString();

        // query to insert employee
        query = 'INSERT INTO Employees (email,password,firstname,lastname,created_at) \
                VALUES ('+ sqlconn.escape(newEmployee.email) + ','
                + sqlconn.escape(newEmployee.password) + ','
                + sqlconn.escape(newEmployee.firstname) + ','
                + sqlconn.escape(newEmployee.lastname) + ','
                + sqlconn.escape(created_at) + ')';

        // execute query
        sqlconn.query(query,  (err, rows, fields) => {
            if (err) return res.status(500).send('Internal server error.');
            else {
                // query to return inserted employee
                query = 'SELECT * FROM Employees WHERE email=' + sqlconn.escape(newEmployee.email);
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    employee = rows[0];
                    // generate json web token
                    const token = genToken(employee, constants.EMPLOYEE);
                    // send employee id and email with the json web tokeb as header
                    return res.status(200).header(constants.X_AUTH_TOKEN, token)
                        .header(constants.ACCESS_CONTROL_EXPOSE_HEADERS, constants.X_AUTH_TOKEN)
                        .send(_.pick(employee, ['eid', 'email']));
                });
            }
        });
    }
});

// update employee data
// only the employee can edit his/her own data
router.put('/me', authEmployeeToken, (req, res) => {
    
    // validate fields in the body
    const { error } = validatePut(req.body); 
    if (error) return res.status(400).send(error.details[0].message);

    eid = req.employee.eid;
    updatedEmployee = _.pick(req.body, ['firstname', 'lastname', 'ssn', 'gender', 'birthdate', 'phone_number', 'address']);

    // query to check if the employee exists
    query = 'SELECT * FROM Employees WHERE eid =' + sqlconn.escape(eid);

    let employee;
    // execute query
    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        if (!employee) return res.status(400).send('Employee has been removed.');
        
        else {
            // if body does not include a field, take its current value in the database
            if (updatedEmployee.firstname === undefined) updatedEmployee.firstname = employee.firstname;
            if (updatedEmployee.lastname === undefined) updatedEmployee.lastname = employee.lastname;
            if (updatedEmployee.ssn === undefined) updatedEmployee.ssn = employee.ssn;
            if (updatedEmployee.gender === undefined) updatedEmployee.gender = employee.gender;
            if (updatedEmployee.birthdate === undefined) updatedEmployee.birthdate = employee.birthdate;
            if (updatedEmployee.phone_number === undefined) updatedEmployee.phone_number = employee.phone_number;
            if (updatedEmployee.address === undefined) updatedEmployee.address = employee.address;

            // query to update employee
            query = 'UPDATE Employees SET \
                firstname=' + sqlconn.escape(updatedEmployee.firstname) +
                ',lastname=' + sqlconn.escape(updatedEmployee.lastname) +
                ',ssn=' + sqlconn.escape(updatedEmployee.ssn) +
                ',gender=' + sqlconn.escape(updatedEmployee.gender) +
                ',birthdate=' + sqlconn.escape(updatedEmployee.birthdate) +
                ',address=' + sqlconn.escape(updatedEmployee.address) +
                ',phone_number=' + sqlconn.escape(updatedEmployee.phone_number) +
                ' WHERE eid=' + sqlconn.escape(eid);

            // execute query
            sqlconn.query(query, function (err, rows, fields) {
                // query to get updated employee
                query = 'SELECT *, NULL as password FROM Employees WHERE eid=' + sqlconn.escape(eid);
                // execute query
                sqlconn.query(query, function (err, rows, fields) {
                    // send updated employee
                    employee = rows[0];
                    return res.status(200).send(employee);
                });
            });            
        }
    });
});

// get current authenticated employee 
router.get('/me', authEmployeeToken, (req, res) => {
    query = 'SELECT *, NULL as password FROM Employees WHERE eid=' + sqlconn.escape(req.employee.eid);

    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        return res.status(200).send(employee);
    });
});

// get employee based on id
router.get('/:eid', authAdminToken, (req, res) => {
    query = 'SELECT *, NULL as password FROM Employees WHERE eid=' + sqlconn.escape(req.params.eid);

    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        return res.status(200).send(employee);
    });
});

// get all employees
router.get('/', authAdminToken, (req, res) => {
    query = 'SELECT *, NULL as password, NULL as ssn FROM Employees';

    sqlconn.query(query, function (err, rows, fields) {
        employees = rows;
        return res.status(200).send(employees);
    });
});

// post validator
function validatePost(employee) {
    const schema = {
        firstname: Joi.string().min(1).max(64).required(),
        lastname: Joi.string().min(1).max(64).required(),
        ssn: Joi.string().max(32).allow(null, ""),
        email: Joi.string().min(1).max(64).email().required(),
        password: Joi.string().min(1).max(128).required(),
        rid: Joi.number()
    };

    return Joi.validate(employee, schema);
}

// put validator
function validatePut(employee) {
    const schema = {
        firstname: Joi.string().min(1).max(64).required(),
        lastname: Joi.string().min(1).max(64).required(),
        ssn: Joi.string().max(32).allow(null, ""), 
        gender: Joi.string().valid('M', 'F').max(1).allow(null, ""),
        phone_number: Joi.string().max(32).allow(null, ""),
        birthdate: Joi.date().max(new Date().setDate(new Date().getDate() - 1)).allow(null, ""),
        address: Joi.string().max(256).allow(null, "")
    };

    return Joi.validate(employee, schema);
}

module.exports = router;