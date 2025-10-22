import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
} from 'discord.js'
import * as format from './format.js'
import type { CommandContext } from './commands.js'

export function startBot(
  cfg: any,
): (channelId: string, content: string) => Promise<void> {
  if (typeof cfg !== 'object') {
    throw new Error('A config must be provided')
  }

  const log = cfg.log || ((...args: any[]) => console.log(...args))
  let users: GuildMember[] = []

  log('Starting PBot')

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
  })

  client.once(Events.ClientReady, () => {
    log(`Connected as ${client.user.tag}`)
    client.guilds.cache.forEach((guild) => {
      void guild.members.fetch().then((members) => {
        log(`Retrieved ${members.size} users from ${guild.name}`)
        users = [...members.values()]
      })
    })
  })

  client.on(Events.GuildMemberAdd, (member) => {
    users.push(member)
    log(`Adding newly joined user '${member.user.username}' to users list`)
  })

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return
    const prefixRegex = new RegExp(`^\\s*(@?pb(?:ot)?\\b|<@&?\\d+>)(.*)`, 'is')
    const prefix = message.content.match(prefixRegex)
    const isMentioned =
      !!prefix &&
      // Can't directly compare @mention against client.user since the IDs seem to vary
      (!prefix[1].startsWith('<@') || message.mentions.has(client.user))
    const isDM = message.channel.type === ChannelType.DM
    if (!isMentioned && !isDM) return

    // Remove bot mention from message content
    const input = (prefix[2] ?? message.content).trim()

    log(`Executing '${input}' triggered by ${message.author.username}`)

    void message.channel.sendTyping()

    const output = async (res: string) => {
      const formatted = format.fancy(res)
      const { length } = formatted
      const maxLength = 2000
      let start = 0

      if (length > maxLength) {
        log(`Sending message in ${Math.ceil(length / maxLength)} chunks`)
      }

      while (start < length) {
        let end = Math.min(start + maxLength, length)

        // Ensure we don't split lines or markdown formatting
        if (end < length) {
          const lastNewline = formatted.lastIndexOf('\n', end)
          const lastCodeBlock = formatted.lastIndexOf('```', end)
          if (lastNewline > start) {
            end = lastNewline + 1
          }
          if (lastCodeBlock > start && lastCodeBlock > end - 3) {
            end = lastCodeBlock + 3
          }
        }

        await message.channel.send(formatted.slice(start, end).trim())
        start = end
      }
    }

    const context = {
      event: message,
      users,
      user: {
        id: message.author.id,
        name: message.author.username,
        displayName: message.member?.nickname || message.author.displayName,
      },
      output,
      ...cfg,
    } satisfies CommandContext

    try {
      const result = await cfg.execute.call(context, input)
      if (result) {
        await output(result)
      }
    } catch (err) {
      log(`Error when handling message: ${err.stack || err}`)
      const errorMessage = `**Error:** ${err.message || err}`.replace(
        /^Error: (\w*Error):/,
        '$1',
      )
      await output(errorMessage)
    }
  })

  // Login to Discord
  void client.login(cfg.token)

  async function message(channelId: string, content: string) {
    try {
      const channel = client.channels.cache.get(channelId)
      if (!channel || !channel.isTextBased() || !channel.isSendable()) {
        throw new Error(`Invalid channel: ${channelId}`)
      }
      await channel.send(content)
      log(`Posted message to channel ${channelId}`)
    } catch (error) {
      log('message() error:', error)
      throw error
    }
  }

  // Allow messages to be manually sent
  return message
}
