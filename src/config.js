
// src/config.js
require('dotenv').config()

module.exports = {
  port: process.env.SMTP_PORT || 2525,
  server: process.env.SMTP_SERVER || 'localhost',
}