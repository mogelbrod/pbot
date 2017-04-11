const SlackBot = require("slackbots")
const format = require("./format")

module.exports = function startBot(cfg) {
  if (typeof cfg !== "object") {
    throw new Error("A config must be provided")
  }

  const log = cfg.log || ((...args) => console.log(...args))

  function message(target, message) {
    return bot.postMessage(target || cfg.defaultChannel, message, {
      icon_emoji: ":beers:",
      mrkdwn: true,
    }).then(data => log(`Posted message to '${target}'`))
      .fail(err => log("message() error: ", err.stack))
  }

  log("Starting PBot")
  const bot = new SlackBot({
    token: cfg.token,
    name: cfg.name || "PBot",
  })

  bot.on("start", () => {
    log("Connected")
    // message(null, "Tjabba tjena hallå!")
  });

  bot.on("close", ev => {
    log("Connection closed, attempting to reconnect")
    bot.connect()
  })

  bot.on("error", ev => {
    log("Connection closed")
  })

  const eventHandlers = {
    reconnect_url(ev) {
      bot.wsUrl = ev.url
    },
    message(ev) {
      if (ev.bot_id || ev.subtype === "bot_message") { return }

      const mentionRegex = new RegExp([
        "^\s*(<@",
        bot.self.id,
        ">|\\b",
        bot.self.name.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"),
        "\\b)"
      ].join(""), "i")
      if (ev.channel[0] !== "D" && !mentionRegex.test(ev.text)) { return }

      // Remove @mention prefix and convert `<value|text>` into `text`
      const cleaned = ev.text.replace(mentionRegex, "").trim()
        .replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
          if (label) {
            return label
          }
          if (type === "@" || type === "#") {
            const entity = bot[type == "@" ? "users" : "channels"].find(x => x.id === link)
            return entity && entity.name || link
          }
          return link
        })

      bot.ws.send(JSON.stringify({ type: "typing", channel: ev.channel }));

      const user = bot.users.find(u => u.id === ev.user)
      log(`Executing '${cleaned}' triggered by ${user && user.name || ev.user}`)
      return cfg.execute.call(Object.assign({
        event: ev,
        users: bot.members,
        user,
      }, cfg), cleaned)
    },
  }

  bot.on("message", ev => {
    let handled = typeof eventHandlers[ev.type] === "function"
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

  // Allow messages to be manually sent
  return message
}
