const fs = require('fs')
const path = require('path')
require('dotenv').config()

const antispamList = fs
  .readFileSync(path.join(__dirname, '../config', 'antispam.txt'), 'utf-8')
  .split('\n')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

const spamContentList = fs
  .readFileSync(path.join(__dirname, '../config', 'spam_content.txt'), 'utf-8')
  .split('\n')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

const spamSubjectList = fs
  .readFileSync(path.join(__dirname, '../config', 'spam_subjects.txt'), 'utf-8')
  .split('\n')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

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

const relayPassIPs = fs
  .readFileSync(path.join(__dirname, '../config', 'relay_pass_ips.txt'), 'utf-8')
  .split('\n')
  .map(ip => ip.trim())
  .filter(Boolean)

const ownDomains = fs
  .readFileSync(path.join(__dirname, '../config', 'own_domains'), 'utf-8')
  .split('\n')
  .map(domain => domain.trim())
  .filter(Boolean)

const validRecipients = fs
  .readFileSync(path.join(__dirname, '../config', 'rcpt_to.in_host_list'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

const forwardRules = require('../config/forwarding-rules').forwardRules
const users = require('../config/users').users

const rcptToTg = fs
  .readFileSync(path.join(__dirname, '../config', 'rcpt_to_tg.in_list'), 'utf-8')
  .split('\n')
  .map(line => line.split(';'))
  .reduce((acc, [email, tgId]) => {
    if (email && tgId) {
      acc[email.trim()] = tgId.trim()
    }
    return acc
  }, {})

const forwardingRules = {
  ownDomains,
  blacklist,
  allowedRelayIPs,
  relayPassIPs,
  validRecipients,
  forwardRules,
  rcptToTg,
  users,
  antispamList,
  spamContentList,
  spamSubjectList
}

module.exports = {
  forwardingRules,
  port: process.env.SMTP_PORT || 2525,
  server: process.env.SMTP_SERVER || 'localhost',
  name: process.env.SMTP_SERVER_NAME
}