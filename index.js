// index.js
const server = require('./server')
const tests = require('./tests/runTests')
require('dotenv').config()

server.startServer()

if (process.env.DEBUG_LEVEL > 1) tests.runTests()
