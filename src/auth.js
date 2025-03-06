// src/auth.js
module.exports = function (connection, username, password, cb) {
  if (username === 'admin' && password === 'secret') {
    return cb(null, true)
  }
  return cb(null, false)
}

