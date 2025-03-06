const fs = require("fs")
const path = require("path")

exports.register = function () {
  this.register_hook("data", "check_subject")
}

exports.check_subject = function (next, connection) {
  const transaction = connection.transaction
  if (!transaction) return next()

  transaction.parse_body = true
  transaction.add_body_filter((content_type, body) => {
    if (content_type === "text/plain") {
      const subject = transaction.header.get("Subject") || ""
      if (subject.toLowerCase().includes("информация")) {
        connection.loginfo("Письмо помечено как СПАМ: " + subject)
        transaction.notes.spam = true

        // Переносим в папку Spam/
        const maildir_path = "/const/mail/haraka/Spam/"
        if (!fs.existsSync(maildir_path)) {
          fs.mkdirSync(maildir_path, { recursive: true })
        }

        const spam_file = path.join(maildir_path, Date.now() + ".eml")
        fs.writeFileSync(spam_file, transaction.body)

        return next(DENY, "Ваше письмо определено как спам и помещено в папку Spam.")
      }
    }
  })

  next()
}
