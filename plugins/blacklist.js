var fs = require("fs")

exports.register = function () {
  this.register_hook("mail", "check_blacklist")
}

exports.check_blacklist = function (next, connection, params) {
  var sender = params[0].address()
  var blacklist_path = __dirname + "/../config/blacklist.ini"

  if (!fs.existsSync(blacklist_path)) return next()

  var blacklist = fs.readFileSync(blacklist_path, "utf8").split("\n").map(line => line.trim())

  if (blacklist.includes(sender)) {
    connection.loginfo("Блокировка письма от " + sender)
    return next(DENY, "Ваш email заблокирован.")
  }

  next()
}
