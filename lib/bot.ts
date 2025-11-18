import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  GuildMember,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  Partials,
} from 'discord.js'
import * as format from './format.js'
import type { CommandContext } from './commands.js'
import type { Output } from './types.js'
import { fetchCalendarEvents, type GoogleEvent } from './google/calendar.js'

export function startBot(cfg: {
  token: string
  defaultChannel?: string
  context: CommandContext
  execute: (this: CommandContext, input: string) => Promise<Output>
  googleCalendar?: {
    calendarId: string
    intervalMinutes?: number
    getToken: () => Promise<string>
  }
}): (channelId: string, content: string) => Promise<void> {
  if (typeof cfg !== 'object') {
    throw new Error('A config must be provided')
  }

  const log = cfg.context.log || ((...args: any[]) => console.log(...args))
  log('[bot] Starting PBot')

  const serverInfo: NonNullable<CommandContext['serverInfo']> = {}
  let users: GuildMember[] = []

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [Partials.Channel, Partials.Message],
  })

  client.on(Events.ClientReady, () => {
    log(`[bot] Connected as ${client.user!.tag}`)
    client.guilds.cache.forEach((guild) => {
      void guild.members.fetch().then((members) => {
        log(`[bot] Retrieved ${members.size} users from ${guild.name}`)
        users = [...members.values()]
      })
    })
  })

  client.on(Events.GuildMemberAdd, (member) => {
    users.push(member)
    log(
      `[bot] Adding newly joined user '${member.user.username}' to users list`,
    )
  })

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return
    const prefixRegex = new RegExp(`^\\s*(@?pb(?:ot)?\\b|<@&?\\d+>)(.*)`, 'is')
    const prefix = message.content.match(prefixRegex)
    const isMentioned =
      !!prefix &&
      // Can't directly compare @mention against client.user since the IDs seem to vary
      (!prefix[1].startsWith('<@') || message.mentions.has(client.user!))
    const isDM = message.channel.type === ChannelType.DM
    if (!isMentioned && !isDM) return

    // Remove bot mention from message content
    const input = (prefix?.[2] ?? message.content).trim()

    log(`[bot] Executing '${input}' triggered by ${message.author.username}`)

    void message.channel.sendTyping()

    async function output(res: Output) {
      const formatted = format.fancy(res)
      const { length } = formatted
      const maxLength = 2000
      let start = 0

      if (length > maxLength) {
        log(`[bot] Sending message in ${Math.ceil(length / maxLength)} chunks`)
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
      ...cfg.context,
      event: message,
      users,
      user: {
        id: message.author.id,
        name: message.author.username,
        displayName: message.member?.nickname || message.author.displayName,
      },
      output,
      serverInfo,
    } satisfies CommandContext

    try {
      const result = await cfg.execute.call(context, input)
      if (result) {
        await output(result)
      }
    } catch (err: any) {
      log(`[bot] Error when handling message: ${err.stack || err}`)
      const errorMessage = `**Error:** ${err.message || err}`.replace(
        /^Error: (\w*Error):/,
        '$1',
      )
      await output(errorMessage)
    }
  })

  // Calendar sync functionality
  if (cfg.googleCalendar) {
    const syncConfig = cfg.googleCalendar
    let syncTimeout: any
    let syncErrorCount = 0

    async function syncCalendarEvents() {
      clearTimeout(syncTimeout)
      syncTimeout = null
      try {
        const guild = client.guilds.cache.first()
        if (!guild) {
          throw new Error('No guild found, skipping calendar sync')
        }
        const timeMin = new Date()
        const timeMax = new Date()
        timeMax.setDate(timeMax.getDate() + 360)
        const token = await syncConfig.getToken()
        const googleEvents = await fetchCalendarEvents({
          calendarId: syncConfig.calendarId,
          token,
          timeMin,
          timeMax,
        })
        const discordEvents = await guild.scheduledEvents.fetch()
        log(
          `[calendar] Got ${googleEvents.length} Google + ${discordEvents.size} Discord events`,
        )
        const matchedDiscordEvents = new Set<string>()
        // Update or create Discord events from Google events
        for (const googleEvent of googleEvents) {
          // Skip events without start time
          if (!googleEvent.start?.dateTime && !googleEvent.start?.date) {
            // log(`[calendar] Skipping event "${googleEvent.summary}" - no start time`)
            continue
          }
          const eventData = googleEventToDiscordEvent(googleEvent)
          // Find existing Discord event by checking description for htmlLink
          const discordEvent = discordEvents.find((discordEvent) =>
            discordEvent.description?.includes(googleEvent.htmlLink),
          )
          if (discordEvent) {
            // Skip events that are in the past
            if (
              (discordEvent.scheduledEndAt ||
                discordEvent.scheduledStartAt ||
                0) < timeMin
            ) {
              matchedDiscordEvents.add(discordEvent.id)
              continue
            }
            matchedDiscordEvents.add(discordEvent.id)
            const needsUpdate =
              discordEvent.name !== eventData.name ||
              discordEvent.description !== eventData.description ||
              discordEvent.scheduledStartAt?.getTime() !==
                eventData.scheduledStartTime.getTime() ||
              discordEvent.scheduledEndAt?.getTime() !==
                eventData.scheduledEndTime.getTime() ||
              discordEvent.entityMetadata?.location !==
                eventData.entityMetadata?.location
            if (needsUpdate) {
              await discordEvent.edit(eventData)
              log(`[calendar] Updated Discord event: ${googleEvent.summary}`)
            }
          } else {
            await guild.scheduledEvents.create(eventData)
            log(`[calendar] Created Discord event: ${googleEvent.summary}`)
          }
        }

        // Delete Discord events that are no longer in Google Calendar
        // Only delete events that we created (contain htmlLink in description)
        // Skip events that are in the past
        for (const [id, discordEvent] of discordEvents) {
          const hasHtmlLink = discordEvent.description?.includes(
            'https://www.google.com/calendar/event?eid=',
          )
          const isInPast =
            (discordEvent.scheduledEndAt ||
              discordEvent.scheduledStartAt ||
              0) < timeMin
          if (hasHtmlLink && !matchedDiscordEvents.has(id) && !isInPast) {
            await discordEvent.delete()
            log(`[calendar] Deleted Discord event: ${discordEvent.name}`)
          }
        }
        // log('[calendar] Sync completed')
        syncErrorCount = 0
      } catch (error: any) {
        syncErrorCount += 1
        log(`[calendar] Sync error #${syncErrorCount}`, error)
      } finally {
        serverInfo['Calendar synced at'] = new Date()
        if (syncErrorCount) {
          serverInfo['Calendar sync errors'] = syncErrorCount
        }

        if (!syncConfig.intervalMinutes) {
          // log(`[calendar] Sync interval not set, not scheduling next sync`)
        } else if (syncErrorCount < 5) {
          syncTimeout = setTimeout(
            syncCalendarEvents,
            syncConfig.intervalMinutes * 60e3,
          )
          // log(`[calendar] Next sync in ${syncConfig.intervalMinutes} min`)
        } else {
          log(
            `[calendar] Not rescheduling sync due to repeated errors (${syncErrorCount})`,
          )
        }
      }
    }

    // Run sync when bot is ready
    client.on(Events.ClientReady, () => {
      void syncCalendarEvents()
    })

    client.on(Events.Error, () => {
      clearTimeout(syncTimeout)
    })
  }

  // Login to Discord
  void client.login(cfg.token)

  async function message(channelId: string, content: string) {
    try {
      const channel = client.channels.cache.get(channelId)
      if (!channel || !channel.isTextBased() || !channel.isSendable()) {
        throw new Error(`Invalid channel: ${channelId}`)
      }
      await channel.send(content)
      log(`[bot] Posted message to channel ${channelId}`)
    } catch (error) {
      log('[bot] message() error:', error)
      throw error
    }
  }

  // Allow messages to be manually sent
  return message
}

/**
 * Converts a Google Calendar event to Discord scheduled event parameters
 */
function googleEventToDiscordEvent(g: GoogleEvent) {
  const startTime = new Date(g.start.dateTime || g.start.date)
  const endTime =
    g.end?.dateTime || g.end?.date
      ? new Date(g.end.dateTime || g.end.date)
      : new Date(startTime.getTime() + 60 * 60 * 1000) // Default 1 hour if no end time
  const entityType = GuildScheduledEventEntityType.External
  let location = g.location || 'TBD'
  if (g.hangoutLink) {
    location = g.hangoutLink
  }
  // Build description with Google Calendar link
  let description = ''
  if (g.description) {
    // Truncate description if too long (Discord limit is 1000 chars)
    description =
      g.description.substring(0, 800) +
      (g.description.length > 800 ? '...\n\n' : '\n\n')
  }
  description += format.linkify('View in Google Calendar', g.htmlLink)

  return {
    name: g.summary.substring(0, 100), // Discord limit
    scheduledStartTime: startTime,
    scheduledEndTime: endTime,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType,
    description: description.substring(0, 1000), // Discord limit
    entityMetadata: {
      location: location.substring(0, 100), // Discord limit
    },
    reason: 'Synced from Google Calendar',
  }
}
