const jwt = require('jsonwebtoken');
const config = require('config');
const constants = require('../helpers/constants');

function authUserToken(req, res, next) {

    const token = req.header(constants.X_AUTH_TOKEN);
    if (!token) return res.status(401).send('Access denied. No token provided.');

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        //let rid = -1;
        //if (req.employee !== undefined) rid = req.employee.rid;
        if (!decoded.uid) return res.status(403).send('Access denied. Not allowed to perform operation.');

        req.user = decoded;

        next();
    }
    catch (e) {
        console.log(e);
        res.status(400).send('Invalid token.');
    }
}
module.exports = authUserToken;