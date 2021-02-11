const mysql = require('mysql');
const config = require('config');

/*
const sqlconn = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'iGum',
    multipleStatements: true
});

sqlconn.getConnection(function(err, connection) {
    if (err) console.log('Could not connect to MySQL...', err); // not connected!
    else console.log('Connected to MySQL...');
    
});
*/
mysqlConfig = {
    host: config.get("mysqlHost"),    
    user: config.get('mysqlUser'),
    password: config.get('mysqlPassword'),
    database: config.get('mysqldb'),
    connectionLimit: 100,
    multipleStatements: true
};


// const sqlconn = mysql.createConnection(mysqlConfig);

// sqlconn.connect();
// sqlconn.query('SELECT 1', function (error, results, fields) {
    //     if (error) console.log('Could not connect to MySQL...', error); // not connected!
    //     else console.log('Connected to MySQL...');
    // });
    
const sqlconn = mysql.createPool(mysqlConfig);
sqlconn.getConnection(function(err, connection) {
    if (err) console.log('Could not connect to MySQL...', err); // not connected!
    else console.log('Connected to MySQL...');
    
});

module.exports = sqlconn;

