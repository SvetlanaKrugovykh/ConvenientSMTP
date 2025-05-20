const axios = require('axios')
const logger = require('./logger')

module.exports.containsSpamContent = function (emailBody, spamContentList) {
  return spamContentList.some((spamPhrase) => emailBody.toLowerCase().includes(spamPhrase.toLowerCase()))
}

module.exports.checkSpamSubject = function (subject, spamSubjectList) {
  return spamSubjectList.some((spamPhrase) => subject.toLowerCase().includes(spamPhrase.toLowerCase()))
}

module.exports.reportSpamToGmail = async function (sender, emailBody) {
  try {
    if (!sender.endsWith('@gmail.com')) {
      logger.info(`Sender ${sender} is not from Gmail. Skipping spam report.`)
      return
    }

    const gmailReportEndpoint = 'https://support.google.com/mail/contact/abuse'
    const reportData = {
      sender,
      emailBody,
    }

    logger.info(`Reporting spam to Gmail for sender: ${sender}`)
    logger.info(`Report data:`, reportData)

    await axios.post(gmailReportEndpoint, reportData)

    logger.info(`Spam report sent to Gmail for sender: ${sender}`)
  } catch (error) {
    logger.error(`Failed to report spam to Gmail for sender: ${sender}`, error)
  }
}