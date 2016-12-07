'use strict';

/**
 * Module Dependencies
 */
var config        = require('./config'),
    bunyan        = require('bunyan'),
    winston       = require('winston'),
    bunyanWinston = require('bunyan-winston-adapter'),
    mysql         = require('mysql'),
    jwt           = require('restify-jwt'),
    Mail          = require('winston-mail').Mail,
    Sentry        = require('winston-sentry');

/**
 * Global Dependencies
 */
global.__base  = __dirname + '/';
global.config  = require('./config.js');
global.restify = require('restify');

/**
 * Transports (Logging)
 */
var transports = [
    new winston.transports.Console({
        level: 'info',
        timestamp: function() {
            return new Date().toString();
        },
        json: true
    })
];

/**
 * Sentry Transport (Logging)
 */
if (process.env.SENTRY) {
    new winston.transports.Console({ level: 'silly' }),
    new Sentry({
        patchGlobal: true,
        dsn: process.env.SENTRY,
    })
}

/**
 * Logging
 */
global.log = new winston.Logger({
    transports: transports
});

/**
 * Initialize Server
 */
global.server = restify.createServer({
    name    : config.name,
    version : config.version,
    log     : bunyanWinston.createAdapter(log),
});

/**
 * Middleware
 */
server.use(restify.bodyParser());
server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.queryParser({ mapParams: true }));
server.pre(require('./lib/cors')());
server.use(restify.fullResponse());
server.use(jwt({ secret: config.jwt.secret }).unless({
    path: ['/users']
}));

/**
 * Initialize MySQL Connection
 */
function handleDisconnect() {
    global.db = mysql.createConnection({
        host     : config.db.host,
        user     : config.db.username,
        password : config.db.password,
        database : config.db.name,
        timezone: 'UTC'
    });

    global.db.connect(function(err) {              // The server is either down
      if(err) {                                     // or restarting (takes a while sometimes).
        console.log('error when connecting to db:', err);
        setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
      }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
    global.db.on('error', function(err) {
      console.log('db error', err);
      if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
        handleDisconnect();                         // lost due to either server restart, or a
      } else {                                      // connnection idle timeout (the wait_timeout
        throw err;                                  // server variable configures this)
      }
    });
}
handleDisconnect();

db.query(`
    SET sql_mode = "STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION"
`)

/**
 * Boot
 */
server.listen(config.port, function () {
    require('./routes');
    log.info(
        '%s v%s ready to accept connections on port listening on port %s in %s environment',
        server.name,
        config.version,
        config.port,
        config.env
    );
});
