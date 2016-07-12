global.databaseUri = 'mongodb://localhost/sup-dev';
var runServer = require('../index').runServer;
before(function(done) {
    runServer(function() {
        done()
    });
});
