require('express-async-errors');
const debug = require('debug')('app:startup');
const config = require('config');
const helmet = require('helmet');
const morgan = require('morgan');

const stats = require('./routes/stats');
const reviews = require('./routes/reviews');
const orders = require('./routes/orders');
const users = require('./routes/users');
const employees = require('./routes/employees');
const ingredients = require('./routes/ingredients');
const products = require('./routes/products');
const flavors = require('./routes/flavors');
const login = require('./routes/login.js');
const home = require('./routes/home');

const express = require('express');
const cors = require('cors');

// check if jwtPrivateKey is defined
if (!config.get('jwtPrivateKey')) {
    console.error('FATAL ERROR: jwtPrivateKey is not defined.');
    process.exit(1);
}

// print uncaught exception scenario
process.on('uncaughtException', (ex) => {
    console.log('UNCAUGHT EXCEPTION. ' + ex);
});

// print unhandled rejection scenario
process.on('unhandledRejection', (ex) => {
    console.log('UNHANDLED REJECTION. ' + ex);
});


const app = express();

// use json on body of requests
app.use(express.json());
// use url encoded
app.use(express.urlencoded({ extended: true }));

// use static as public
app.use(express.static('public'));

// use helmet to increase secutiry
app.use(helmet());

// define cross-origin resource sharing
app.use(cors());

// add routes
app.use('/', home);
app.use('/api/stats', stats);
app.use('/api/reviews', reviews);
app.use('/api/orders', orders);
app.use('/api/ingredients', ingredients);
app.use('/api/products', products);
app.use('/api/flavors', flavors);
app.use('/api/users', users);
app.use('/api/employees', employees);
app.use('/api/login', login);

// use morgan in development environment
if (app.get('env') === 'development') {
    app.use(morgan('tiny'));
    debug('Morgan enabled...');
}

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Listening on port ${port}...`));

