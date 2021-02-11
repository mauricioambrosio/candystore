const mongoconn = require('../helpers/mongoconn');

const reviewSchema = new mongoconn.Schema({
    uid: {type:Number, required: true},
    pid: {type:Number, required: true},
    datetime: { type: Date, default: Date.now, required:true },
    score: { type: Number, min: 1, max: 5, required: true },
    text: {type: String}
});

const Review = mongoconn.model('Reviews', reviewSchema);
module.exports = Review;