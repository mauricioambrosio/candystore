const sqlconn = require('../helpers/sqlconn');

// check if engredients exist in the database
function ingredientsExist(ingredients) {
    return new Promise((resolve, reject) => {

        if (ingredients.length == 0) return resolve(true);

        query = 'SELECT * FROM Ingredients WHERE';

        for (i = 0; i < ingredients.length; i++) {
            if (i == 0) {
                query = query + ' iid=' + sqlconn.escape(ingredients[i]);
            } else {
                query = query + ' or iid=' + sqlconn.escape(ingredients[i]);
            }
        }
        query = query + ';';

        sqlconn.query(query, function (err, rows, fields) {
            if (rows.length === ingredients.length) resolve(true);
            else resolve(false);
        });
    });
}

module.exports = ingredientsExist;