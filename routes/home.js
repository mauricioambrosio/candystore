const express = require('express');
const router = express.Router();

// home route
router.get('/', (req, res) => {
    res.send('Candy Store Backend API');
});

module.exports=router;