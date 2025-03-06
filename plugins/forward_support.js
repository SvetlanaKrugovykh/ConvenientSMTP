var fs = require("fs")
var logFile = "/var/log/haraka_forward.log"

exports.register = function () {
  this.register_hook("rcpt", "redirect_support")
}

exports.redirect_support = function (next, connection, params) {
  var recipient = params[0].address()
  if (recipient === "support@domenName.com") {
    connection.loginfo("Пересылка support@ на три адреса")

    var transaction = connection.transaction
    if (!transaction) return next()

    transaction.rcpt_to.pop() // Убираем оригинальный адрес

    var forward_addresses = [
      "admin1@domenName.com",
      "admin2@domenName.com",
      "admin3@domenName.com"
    ]
    forward_addresses.forEach(email => {
      transaction.rcpt_to.push(new Address(email))
    })

    var logEntry = `[${new Date().toISOString()}] Пересылка: ${recipient} → ${forward_addresses.join(", ")}\n`
    fs.appendFileSync(logFile, logEntry)

    connection.loginfo("Лог записан: " + logEntry)
  }

  next()
}
