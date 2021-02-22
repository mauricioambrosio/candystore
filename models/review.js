const mongoconn = require('../helpers/mongoconn');

const schema = {
    uid: {type:Number, required: true},
    pid: {type:Number, required: true},
    // datetime: { type: Date, default: Date.now, required:true },
    score: { type: Number, min: 1, max: 5, required: true },
    text: {type: String}
};

const schemaOptions = { timestamps: true };

const Review = mongoconn.model(
    'Reviews', 
    new mongoconn.Schema(schema, schemaOptions)
);

module.exports = Review;