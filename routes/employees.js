const moment = require('moment');
const authEmployeeToken = require('../middlewares/authEmployeeToken');
const authAdminToken = require('../middlewares/authAdminToken');
const {employeeEmailExists} = require('../helpers/emailExists');

const constants = require('../helpers/constants');

const _ = require('lodash');
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const sqlconn = require('../helpers/sqlconn');
const genToken = require('../helpers/genToken');


router.post('/', authAdminToken, async (req, res) => {

    const { error } = validatePost(req.body); //result.error

    if (error) return res.status(400).send(error.details[0].message);

    newEmployee = _.pick(req.body, ['email', 'password', 'firstname', 'lastname']);

    console.log(await employeeEmailExists(newEmployee.email));

    if (await employeeEmailExists(newEmployee.email))
        return res.status(400).send('Email already being used.');
    else {
        const salt = await bcrypt.genSalt(10);
        newEmployee.password = await bcrypt.hash(newEmployee.password, salt);
        const created_at = moment().format('YYYY-MM-DD').toString();

        query = 'INSERT INTO Employees (email,password,firstname,lastname,created_at) \
            VALUES ('+ sqlconn.escape(newEmployee.email) + ','
            + sqlconn.escape(newEmployee.password) + ','
            + sqlconn.escape(newEmployee.firstname) + ','
            + sqlconn.escape(newEmployee.lastname) + ','
            + sqlconn.escape(created_at) + ')';

        sqlconn.query(query,  (err, rows, fields) => {
            if (err) return res.status(500).send('Internal server error.');
            else advance();
        });

        async function advance(){
            query = 'SELECT * FROM Employees WHERE email=' + sqlconn.escape(newEmployee.email);
            sqlconn.query(query, function (err, rows, fields) {
                employee = rows[0];
                const token = genToken(employee, constants.EMPLOYEE);
                return res.status(200).header(constants.X_AUTH_TOKEN, token).header(constants.ACCESS_CONTROL_EXPOSE_HEADERS, constants.X_AUTH_TOKEN).send(_.pick(employee, ['eid', 'email']));
            });
        }
    }
});


router.put('/me', authEmployeeToken, (req, res) => {

    const { error } = validatePut(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    eid = req.employee.eid;
    updatedEmployee = _.pick(req.body, ['firstname', 'lastname', 'ssn', 'gender', 'birthdate', 'phone_number', 'address']);

    query = 'SELECT * FROM Employees WHERE eid=' + sqlconn.escape(eid);

    var employee;
    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        if (!employee) return res.status(400).send('Employee has been removed.');
        else advance();
    });

    async function advance() {
        if (updatedEmployee.firstname === undefined) updatedEmployee.firstname = employee.firstname;
        if (updatedEmployee.lastname === undefined) updatedEmployee.lastname = employee.lastname;
        if (updatedEmployee.ssn === undefined) updatedEmployee.ssn = employee.ssn;
        if (updatedEmployee.gender === undefined) updatedEmployee.gender = employee.gender;
        if (updatedEmployee.birthdate === undefined) updatedEmployee.birthdate = employee.birthdate;
        if (updatedEmployee.phone_number === undefined) updatedEmployee.phone_number = employee.phone_number;
        if (updatedEmployee.address === undefined) updatedEmployee.address = employee.address;



        query = 'UPDATE Employees SET\
            firstname=' + sqlconn.escape(updatedEmployee.firstname) +
            ',lastname=' + sqlconn.escape(updatedEmployee.lastname) +
            ',ssn=' + sqlconn.escape(updatedEmployee.ssn) +
            ',gender=' + sqlconn.escape(updatedEmployee.gender) +
            ',birthdate=' + sqlconn.escape(updatedEmployee.birthdate) +
            ',address=' + sqlconn.escape(updatedEmployee.address) +
            ',phone_number=' + sqlconn.escape(updatedEmployee.phone_number) +
            ' WHERE eid=' + sqlconn.escape(eid);

        sqlconn.query(query, function (err, rows, fields) {
            getUpdatedEmployee();
        });

        function getUpdatedEmployee() {
            query = 'SELECT *, NULL as password FROM Employees WHERE eid=' + sqlconn.escape(eid);
            sqlconn.query(query, function (err, rows, fields) {
                employee = rows[0];

                res.status(200).send(employee);
            });
        }
    }
});

router.get('/me', authEmployeeToken, (req, res) => {

    query = 'SELECT *, NULL as password, NULL as ssn FROM Employees WHERE eid=' + sqlconn.escape(req.employee.eid);

    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        res.send(employee);
    });
});

router.get('/:eid', authEmployeeToken, (req, res) => {
    query = 'SELECT *, NULL as password, NULL as ssn FROM Employees WHERE eid=' + sqlconn.escape(req.params.eid);

    sqlconn.query(query, function (err, rows, fields) {
        employee = rows[0];
        res.send(employee);
    });
});

router.get('/', authAdminToken, (req, res) => {

    query = 'SELECT *, NULL as password, NULL as ssn FROM Employees';

    sqlconn.query(query, function (err, rows, fields) {
        employees = rows;
        res.send(employees);
    });
});


function validatePost(employee) {
    const schema = {
        firstname: Joi.string().max(64).required(),
        lastname: Joi.string().max(64).required(),
        email: Joi.string().max(64).required().email(),
        password: Joi.string().max(64).required(),
        rid: Joi.number()
    };

    return Joi.validate(employee, schema);
}

function validatePut(employee) {
    const schema = {
        firstname: Joi.string().max(64),
        lastname: Joi.string().max(64),
        email: Joi.string().max(64).email(),
        ssn: Joi.string().max(32).allow(null),
        gender: Joi.string().valid('M', 'F').max(1).allow(null),
        phone_number: Joi.string().max(32).allow(null),
        birthdate: Joi.date().allow(null),
        address: Joi.string().max(256).allow(null)
    };


    return Joi.validate(employee, schema);
}

module.exports = router;