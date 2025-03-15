const fs = require('fs')
const path = require('path')
require('dotenv').config()

const blacklist = fs
  .readFileSync(path.join(__dirname, '../config', 'blacklist.txt'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

const allowedRelayIPs = fs
  .readFileSync(path.join(__dirname, '../config', 'allowed_ips.txt'), 'utf-8')
  .split('\n')
  .map(ip => ip.trim())
  .filter(Boolean)

const validRecipients = fs
  .readFileSync(path.join(__dirname, '../config', 'rcpt_to.in_host_list'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

const forwardRules = require('../config/forwarding-rules').forwardRules

const forwardingRules = {
  blacklist,
  allowedRelayIPs,
  validRecipients,
  forwardRules
}

module.exports = {
  forwardingRules,
  port: process.env.SMTP_PORT || 2525,
  server: process.env.SMTP_SERVER || 'localhost'
}