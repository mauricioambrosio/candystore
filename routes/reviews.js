const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Review = require('../models/review');
const authUserToken = require('../middlewares/authUserToken');
const sqlconn = require('../helpers/sqlconn');

//const mongoconn = require('../helpers/mongoconn');
const _ = require('lodash');


router.get('/', async (req, res) => {

    let reviews = await Review.find().sort({ datetime: -1 });

    for (i in reviews) {
        reviews[i] = await appendUser(reviews[i]);
    }
    res.status(200).send(reviews);
});


router.get('/:id', async (req, res) => {

    const rid = req.params.id;

    const reviews = await Review.find({ _id: rid });

    const review = await appendUser(reviews[0]);

    res.status(200).send(review);

});

router.get('/pid/:id', async (req, res) => {

    const pid = req.params.id;

    let reviews = await Review.find({ pid: pid }).sort({ datetime: -1 });

    for (i in reviews) {
        reviews[i] = await appendUser(reviews[i]);
    }
    res.status(200).send(reviews);
});


function appendUser(review) {
    return new Promise((resolve, reject) => {
        const fullReview = _.pick(review, ['_id', 'uid', 'pid', 'score', 'text', 'datetime']);
        query = 'SELECT firstname, lastname FROM Users WHERE uid=' + sqlconn.escape(fullReview.uid);
        sqlconn.query(query, function (err, rows, fields) {
            var user = rows[0];
            fullReview['firstname'] = user.firstname;
            fullReview['lastname'] = user.lastname;
            resolve(fullReview);
        });
    });
}


router.get('/uid/:id', async (req, res) => {

    const uid = req.params.id;

    let reviews = await Review.find({ uid: uid }).sort({ datetime: -1 });

    for (i in reviews) {
        reviews[i] = await appendUser(reviews[i]);
    }

    res.status(200).send(reviews);

});


router.post('/', authUserToken, async (req, res) => {

    const { error } = validatePost(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message)

    const review = new Review({
        uid: req.user.uid,
        pid: req.body.pid,
        score: req.body.score,
        text: req.body.text
    });

    await review.save(function (err, review) {
        if (err) return res.status(500).send('Unable to insert.' + err);
        return res.status(200).send(review);
    });
});

function validatePost(review) {
    const schema = {
        pid: Joi.number().required(),
        score: Joi.number().min(1).max(5).required(),
        text: Joi.string().allow(null, "")
    }
    return Joi.validate(review, schema);
}


/*
router.put('/:id', authEmployeeToken, (req, res)=>{
    
    const { error } = validatePut(req.body); //result.error
    if (error) return res.status(400).send(error.details[0].message);

    const pid = req.params.id;

    updatedProduct=_.pick(req.body,['name','price']);

    query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);

    sqlconn.query(query, function (err, rows, fields) {
        product = rows[0];
        if (!product) return res.status(400).send('Product does not exist.');
        else advance();
    });

    async function advance() {
        if(!updatedProduct.name)updatedProduct.name=product.name;
        if(!updatedProduct.price)updatedProduct.name=product.price;
        

        query = 'UPDATE Products SET\
        name='+sqlconn.escape(updatedProduct.name)+
        ',price='+sqlconn.escape(updatedProduct.price)+
        ' WHERE pid='+sqlconn.escape(pid);

        sqlconn.query(query, function (err, rows, fields) {   
        });

        query = 'SELECT * FROM Products WHERE pid=' + sqlconn.escape(pid);
        sqlconn.query(query, function (err, rows, fields) {
            product = rows[0];

            res.status(200).send(product);    
        });
    }
});


function validatePut(product) {
    const schema = {
        name: Joi.string().max(64).required(),
        price: Joi.number()
    }
    return Joi.validate(product, schema);
}
*/

module.exports = router;


