const SlackBot = require("slackbots")

module.exports = function startBot(cfg) {
  if (typeof cfg !== "object") {
    throw new Error("A cfg must be provided")
  }

  const log = cfg.log || ((...args) => console.log(...args))
  const defaultChannel = cfg.defaultChannel || "general"

  function message(target, message) {
    return bot.postTo(target || defaultChannel, message, {
      icon_emoji: ":beers:",
    }).then(data => log("Posted message to '${target}'"))
      .fail(err => log("Error: ", err))
  }

  log("Starting PBot")
  const bot = new SlackBot({
    token: cfg.token,
    name: cfg.name || "PBot",
  })

  bot.on("start", () => {
    log("Connected")
    message(null, "Tjabba tjena hallå!")
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
      // bot.ws.send(JSON.stringify({ type: 'typing', channel: channelid }));
    },
  }

  bot.on("message", ev => {
    let handled = typeof eventHandlers[ev.type] === "function"
    if (handled) {
      eventHandlers[ev.type](ev)
    }
    log((handled ? "Handling incoming:" : "Incoming:"), JSON.stringify(ev, null, 2))
  })
}
