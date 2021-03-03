const jwt = require('jsonwebtoken');
const config = require('config');
const constants = require('../helpers/constants');

// middleware to check if request comes from authenticated user based on json web token provided in header
function authUserToken(req, res, next) {

    const token = req.header(constants.X_AUTH_TOKEN);
    if (!token) return res.status(401).send('Access denied. No token provided.');

    try {
        const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
        
        // check if uid (user id) exists
        if (!decoded.uid) return res.status(403).send('Access denied. Not allowed to perform operation.');

        req.user = decoded;

        next();
    }
    catch (e) {
        res.status(400).send('Invalid token.');
    }
}
module.exports = authUserToken;