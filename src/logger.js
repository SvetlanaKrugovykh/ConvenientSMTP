
// src/logger.js
const fs = require('fs')
const path = require('path')

var logFile = fs.createWriteStream(path.join(__dirname, '../logs/server.log'), { flags: 'a' })

function log(level, message) {
  var logMessage = new Date().toISOString() + ' [' + level.toUpperCase() + '] ' + message + '\n'
  logFile.write(logMessage)
  console.log(logMessage)
}

module.exports = {
  info: function (message) {
    log('info', message)
  },
  error: function (message) {
    log('error', message)
  }
}