// index.js
const server = require('./server')
const tests = require('./tests/sendmail')
require('dotenv').config()

server.startServer()

if (process.env.DEBUG_LEVEL > 1) tests.runTests()
