process.env.PORT = '3200';
process.env.DB_PATH = require('path').join(__dirname, '..', 'data', 'it-ops.db');
const server = require('../server');
server.listen(3200, '127.0.0.1', () => console.log('READY'));
