const mysql = require('mysql');
const config = require('config');

// mysql config params for connection pool
mysqlConfig = {
    host: config.get("mysqlHost"),    
    user: config.get('mysqlUser'),
    password: config.get('mysqlPassword'),
    database: config.get('mysqldb'),
    connectionLimit: 100,
    multipleStatements: true
};

// mysql connection pool used throughout the project
const sqlconn = mysql.createPool(mysqlConfig);
sqlconn.getConnection(function(err, connection) {
    if (err) console.log('Could not connect to MySQL...', err); // not connected!
    else console.log('Connected to MySQL...');
    
});

module.exports = sqlconn;

