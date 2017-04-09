// 2017-04-04T17:30:00.000Z => 2017-04-04 17:30[:00]
exports.time = (str, seconds = false) => {
  if (str instanceof Date) {
    str = str.toISOString()
  }
  return str.replace("T", " ").replace(seconds ? /\.\d{3}Z/ : /:\d\d\.\d{3}Z/, "")
}

exports.log = (...args) => "[" + exports.time(new Date, true) + "] " + args.join(" ")
