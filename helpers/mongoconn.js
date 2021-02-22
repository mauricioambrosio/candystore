const mongoose = require('mongoose');
const config = require('config');

mongoose.connect(config.get('mongodb'), {useNewUrlParser:true})
        .then(function(){
            console.log('Connected to MongoDB...');
        })
        .catch(function(err){
            console.log('Could not connect to MongoDB...', err);
        });
module.exports = mongoose;
