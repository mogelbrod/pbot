const Backoff = require('backo')
const SlackBot = require('slackbots')
const format = require('./format')

module.exports = function startBot(cfg) {
  if (typeof cfg !== 'object') {
    throw new Error('A config must be provided')
  }

  const log = cfg.log || ((...args) => console.log(...args))
  const backoff = new Backoff({ min: 50, max: 60e3 })
  const timeout = 60e3
  let lastMessageTime = null
  let pingInterval, messageTimeout

  log('Starting PBot')
  const bot = new SlackBot({
    token: cfg.token,
    name: cfg.name || 'PBot',
  })

  bot.on('start', () => {
    log('Connected')
    backoff.reset()
  })

  bot.on('open', () => {
    pingInterval = setInterval(ping, timeout/2)
  })

  bot.on('close', ev => {
    const delay = backoff.duration()
    log(`Connection closed, attempting to reconnect in ${delay}ms`)
    log(ev.message)
    clearInterval(pingInterval)
    clearTimeout(messageTimeout)
    setTimeout(bot.login.bind(bot), delay)
  })

  bot.on('error', log)

  const eventHandlers = {
    reconnect_url(ev) {
      log('Got new reconnect_url')
      bot.wsUrl = ev.url
    },
    message(ev) {
      if (ev.bot_id || ev.subtype === 'bot_message') { return }

      const mentionRegex = new RegExp([
        '^\s*(<@',
        bot.self.id,
        '>|\\b',
        bot.self.name.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'),
        '\\b)'
      ].join(''), 'i')
      if (ev.channel[0] !== 'D' && !mentionRegex.test(ev.text)) { return }

      // Remove @mention prefix and convert `<value|text>` into `text`
      const cleaned = ev.text.replace(mentionRegex, '').trim()
        .replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
          if (label) {
            return label
          }
          if (type === '@' || type === '#') {
            const entity = bot[type === '@' ? 'users' : 'channels'].find(x => x.id === link)
            return entity && entity.name || link
          }
          return link
        })

      bot.ws.send(JSON.stringify({ type: 'typing', channel: ev.channel }))

      const user = bot.users.find(u => u.id === ev.user)
      log(`Executing '${cleaned}' triggered by ${user && user.name || ev.user}`)
      const context = Object.assign({
        event: ev,
        users: bot.members,
        user,
        output: res => message(ev.channel, format.fancy(res)),
      }, cfg)
      return cfg.execute.call(context, cleaned)
    },
    team_join(ev) {
      // Manually append new users since slackbots only retrieves users on boot
      bot.users.push(ev.user)
      log(`Adding newly joined user '${ev.user && ev.user.name || ev.user}' to users list`)
    },
  }

  bot.on('message', ev => {
    lastMessageTime = new Date()
    clearTimeout(timeout)
    messageTimeout = setTimeout(assertMessageReceived, timeout)

    let handled = typeof eventHandlers[ev.type] === 'function'
    if (handled) {
      Promise.resolve().then(() => eventHandlers[ev.type](ev))
        .catch(err => {
          log(`Error when handling '${ev.type}':\n` + (err.stack || err))
          return `Error: ${err.message || err}`
        }).then(res => {
          return res == null ? res : message(ev.channel, format.fancy(res))
        })
    }
  })

  function ping() {
    // log("Pinging slack")
    bot.ws.send(JSON.stringify({ kind: 'ping' }), err => {
      if (err) {
        log('Ping failed: ', err.message)
        bot.ws.close()
      }
    })
  }

  function assertMessageReceived() {
    if (new Date() - timeout > lastMessageTime) {
      log(`No messages received since ${lastMessageTime.toLocaleTimeString()}, triggering reconnect`)
      bot.ws.close()
    }
  }

  function message(target, message) {
    return bot.postMessage(target || cfg.defaultChannel, message, {
      icon_emoji: ':beers:',
      mrkdwn: true,
    }).then(data => log(`Posted message to '${target}'`))
      .fail(err => log('message() error: ', err.stack))
  }

  // Allow messages to be manually sent
  return message
}
