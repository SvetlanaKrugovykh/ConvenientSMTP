const dnsBase = require('dns')
dnsBase.setServers(['1.1.1.1', '8.8.8.8'])
const dns = dnsBase.promises
const configData = require('./config')

const RBL_LISTS = [
  'zen.spamhaus.org',
  'b.barracudacentral.org',
  'bl.spamcop.net'
]

module.exports.checkBlacklists = async function (ip) {
  const reversedIp = ip.split('.').reverse().join('.')

  for (const rbl of RBL_LISTS) {
    try {
      await dns.resolve(`${reversedIp}.${rbl}`)
      return true
    } catch (err) {
      continue
    }
  }
  return false
}


module.exports.checkSPF = async function (fromDomain, ip) {
  try {
    const txtRecords = await dns.resolveTxt(fromDomain)
    const spfRecord = txtRecords.flat().find(record => record.startsWith('v=spf1'))
    if (!spfRecord) return false

    return spfRecord.includes(ip) || spfRecord.includes('~all') || spfRecord.includes('-all') === false
  } catch (err) {
    return false
  }
}


module.exports.checkPTR = async function (ip) {
  try {
    if (configData.forwardingRules.allowedRelayIPs.includes(ip)) {
      return true
    }
    const ptrRecords = await dns.reverse(ip)
    return ptrRecords.length > 0
  } catch (err) {
    return false
  }
}




