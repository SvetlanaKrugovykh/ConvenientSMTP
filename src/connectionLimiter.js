const ipMap = new Map()

module.exports.canConnect = function (ip, maxPerMinute = 3) {
  const now = Date.now()
  if (!ipMap.has(ip)) ipMap.set(ip, [])
  const times = ipMap.get(ip).filter(t => now - t < 60000)
  if (times.length >= maxPerMinute) return false
  times.push(now)
  ipMap.set(ip, times)
  return true
}

