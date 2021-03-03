// check if email already exists in users or employees table
const sqlconn = require('../helpers/sqlconn');

async function emailExists(email) {
    if (
        await userEmailExists(email) 
        || await employeeEmailExists(email)
    )
        return true;
    else return false;
}

// check if email already exists in users table
async function userEmailExists(email) {
    promiseRes = await new Promise((resolve, reject) => {
        query = 'SELECT * FROM Users WHERE email=' + sqlconn.escape(email);
        sqlconn.query(query, function (err, rows, fields) {
            if (rows.length !== 0) resolve(true);
            else resolve(false);
        });
    });

    return promiseRes;
}

// check if email already exists in employees table
async function employeeEmailExists(email) {
    promiseRes = await new Promise((resolve, reject) => {
        query = 'SELECT * FROM Employees WHERE email=' + sqlconn.escape(email);
        sqlconn.query(query, function (err, rows, fields) {
            if (rows.length !== 0) resolve(true);
            else resolve(false);
        });
    });

    return promiseRes;
}
module.exports.emailExists = emailExists;
module.exports.userEmailExists = userEmailExists;
module.exports.employeeEmailExists = employeeEmailExists;