const jwt = require('jsonwebtoken');
const config = require('config');


function genToken(entity, type) {
    var token;
    if (type == 'user') {

        const user = entity;

        token = jwt.sign(
            { uid: user.uid, email: user.email },
            config.get('jwtPrivateKey'));
        return token;

    } else if (type == 'employee') {

        const employee = entity;

        token = jwt.sign(
            { eid: employee.eid, email: employee.email, rid: employee.rid },
            config.get('jwtPrivateKey'));
        return token;
    }

    /*else if (type == 'admin') {

        const employee = entity;

        token = jwt.sign(
            { eid: employee.eid, email: employee.email, role: employee.role },
            config.get('jwtPrivateKey'));
        return token;
    }*/

    return console.log("Internal server error. Invalid type provided to genToken.");
}

module.exports = genToken;