/*
* 	autor: jibieta
*	ayuda: 
* 	https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
*	https://stackoverflow.com/questions/7989476/how-does-the-google-url-shortener-generate-a-5-digit-hash-without-collisions
*   ab -c 10 -n 1000 http://localhost:3000/15FTGh
*/

var express = require('express');
var redis = require('redis');
var base62 = require("base62/lib/ascii");
var mysql = require('mysql');
var bodyParser = require('body-parser');
var app = express();

// Esto sirve para poder parsear el body de la peticion.
app.use(bodyParser.urlencoded({extended: false}));


const REDIS_HOST = 'localhost';
const REDIS_PORT = 6379;
const MYSQL_HOST = 'localhost';
const MYSQL_USER = 'test_user';
const MYSQL_PASSWORD = 'test_password';
const MYSQL_DB = 'dbshorturls';
const MIN_NUMBER_BASE_62 = 916132832;



const SHORT_DOMAIN =  'http://localhost:3000/';
app.SHORT_DOMAIN = SHORT_DOMAIN;

// conexión a MySQL.
const connection = mysql.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DB
});

// conexióna redis, se usa como mecanismo de caché.
const client = redis.createClient({
    host: REDIS_HOST,
    port: REDIS_PORT
});

(async () => {
    await client.connect();
})();


client.on('error', function(err) {
    console.log('error al conectar con redis');
    process.exit();
});

connection.connect(function(err) {
    if (err) {
        console.error('error al conectar MySQL');
        console.error(err);
        process.exit();
    }
});


/**
 *
 * URL
 *
 */
app.get('/*', async function (req, res) {

    // Obtenemos el codigo corto de la URL.
    var url_code = req.params[0];


    // Obtenemos el ID de la URL corta.
    var id = base62.decode(url_code);

    var long_url;

    // existe en la caché?
    if (await client.exists(url_code)) {

        var long_url = await client.get(url_code);

        res.redirect(long_url);


    } else {

	    // Obtenemos la URL larga del ID.
	    connection.query('SELECT a.longurl from shorturls a WHERE a.id = ?', id, async function (error, results) {

	        if (error) throw error;

	        if (results.length === 0) {
	            return res.status(302).send()
	        }

	        var long_url = results[0].longurl;
	        await client.set(url_code, long_url);
            res.redirect(long_url);
	    });
    }

	connection.query('UPDATE shorturls SET count = count + 1 WHERE id = ?', id, function (error, results, fields) {
		if (error) throw error;
	});

});


/**
 * Obtiene una URL corta de una URL Larga.
 */
app.post('/get-short-url', async function (req, res) {

    var long_url = req.body.url;

    connection.query('SELECT max(id) as id from shorturls', function (error, results, fields) {

        if (error) throw error;


        var index = results[0].id === null ? MIN_NUMBER_BASE_62 : results[0].id;
        var max_id = index + 1;
        var short_url = base62.encode(max_id);

        var insert = {
            id: max_id,
            shorturl: short_url,
            longurl: long_url,
            count: 0,
            created: new Date()
        };

        connection.query('INSERT INTO shorturls SET ?', insert, function (error, result, fields) {

            if (error) throw error;

            res.json({
                'url': SHORT_DOMAIN + short_url
            });

        });

    });
});


/**
 * Borra una URL corta.
 */
app.post('/delete-short-url', async function (req, res) {

    var short_url = req.body.url;
    var domain = short_url.substr(0, SHORT_DOMAIN.length);

    if (domain !== SHORT_DOMAIN) {
        res.json({
            'error': 'URL inválida'
        });
    }

    // Obtenemos el código de la URL ingresada.
    var url_code = short_url.substr(SHORT_DOMAIN.length);

    // Obtenemos el ID de la URL corta.
    var id = base62.decode(url_code);

    // Obtenemos la URL larga del ID.
    connection.query('DELETE from shorturls a WHERE a.id = ?', [id], function (error, results, fields) {

        if (error) throw error;

        res.json({
            'url': short_url
        });
    });
});


/**
 * Obtiene una URL larga de una URL corta.
 */
app.post('/get-long-url', async function (req, res) {

    var short_url = req.body.url;
    var domain = short_url.substr(0, SHORT_DOMAIN.length);


    if (domain !== SHORT_DOMAIN) {
        return res.json({
            'error': 'URL inválida'
        });
    }

    // Obtenemos el código de la URL ingresada.
    var url_code = short_url.substr(SHORT_DOMAIN.length);

    // Obtenemos el ID de la URL corta.
    var id = base62.decode(url_code);

    // Obtenemos la URL larga del ID.
    connection.query('SELECT a.longurl from shorturls a WHERE a.id = ?', [id], function (error, results, fields) {

        if (error) throw error;

        return res.json({
            'url': results[0].longurl
        });
    });
});


/**
 * Obtiene estadísticas.
 */
app.post('/get-statistics', async function (req, res) {

    connection.query('SELECT (SELECT COUNT(*) FROM shorturls) AS number_of_urls, (SELECT SUM(a.count) FROM shorturls a) AS total_of_request', 

        function (error, results, fields) {

        if (error) throw error;

        connection.query('SELECT a.longurl AS url, COUNT(*) AS request from shorturls a GROUP BY a.longurl ORDER BY COUNT(*) desc LIMIT 0, 10', function (error, table, fields) {

            if (error) throw error;

            return res.json({
                'total_of_urls': results[0].number_of_urls,
                'total_of_request': results[0].total_of_request,
                'total_of_request_list': table
            });
        });

    });

});



/**
* start server
*/
app.listen(3000, function () {
    console.log('--- listening on port 3000----');
});

module.exports = app;