const jwt = require('jsonwebtoken');
const config = require('config');
const constants = require('../helpers/constants');

function authAdminToken(req, res, next) {

    const token = req.header(constants.X_AUTH_TOKEN);
    if (!token) return res.status(401).send('Access denied. No token provided.');

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        if (decoded.rid !== constants.ADMIN_ID) return res.status(403).send('Access denied. Not allowed to perform operation.');

        req.employee = decoded;

        next();
    }
    catch (e) {
        res.status(400).send('Invalid token.');
    }
}
module.exports = authAdminToken;