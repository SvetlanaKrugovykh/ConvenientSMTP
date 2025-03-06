// src/relay.js
const config = require('./config')

module.exports = function (connection, next) {
  var remote_ip = connection.remote.ip
  if (config.allowed_ips.includes(remote_ip)) {
    return next()
  }
  connection.loginfo('Отказано в доступе для IP: ' + remote_ip)
  return next(DENY, 'Недопустимый IP для релея.')
}
