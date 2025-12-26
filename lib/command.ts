import * as f from './format.js'
import { isAdmin, enumValue } from './backend.js'
import { isInt, toInt, clamp, rejectError } from './utils.js'
import type {
  Backend,
  Config,
  EntityForTable,
  Member,
  Output,
  TableName,
  User,
} from './types.js'
import type { GuildMember } from 'discord.js'

/** Execution context bound for command handlers. */
export interface CommandContext {
  config: Config
  backend: Backend
  log: (...args: any[]) => void
  output: (result: any) => void
  event?: unknown
  user?: User
  users?: GuildMember[]
  serverInfo?: {
    [key: string]: unknown
  }
}

/** ES5-style command function signature bound via `this: CommandContext`. */
export type CommandFn = (
  this: CommandContext,
  ...args: string[]
) => Output | Promise<Output>

/** Registered commands mapping name to description and implementation. */
export const commands: Record<string, { description: string; fn: CommandFn }> =
  {}

export async function registerCommands(): Promise<typeof commands> {
  await import('./commands/index.js')
  return commands
}

/**
 * Parse and execute the given input string against registered commands.
 *
 * @param input - Raw input string or tokens array.
 * @return Execution result
 */
export function execute(
  this: CommandContext,
  input: string[] | string,
): Promise<Output> {
  if (typeof this !== 'object' || !this.backend) {
    throw new Error('Must provide a valid execution context as `this`')
  }

  return Promise.resolve().then(() => {
    if (typeof input === 'string') {
      input = f.tokenize(input)
    }

    // TODO: Should this be done here?
    if (!f.basic()) {
      input = input.map(f.unescape)
    }

    if (isInt(input[0])) {
      input.unshift('drink')
    }

    let commandName = input.shift()
    if (typeof commandName !== 'string' || !commandName.length) {
      commandName = 'help'
    } else {
      commandName = commandName.toLowerCase()
    }

    const commandDef = commands[commandName]

    if (!commandDef || typeof commandDef.fn !== 'function') {
      throw new Error(`Unknown command \`${f.escape(commandName)}\``)
    }
    if (commandDef.fn.length > input.length) {
      throw new Error(
        `Insufficient number of arguments for \`${commandName}${functionToArgsString(commandName)}\``,
      )
    }

    return commandDef.fn.apply(this, input)
  })
}

/** Infer a string of argument names from a command's function source. */
export function functionToArgsString(command: string, leadingSpace = true) {
  const definition = commands[command]
  if (!definition) {
    throw new Error(`Command \`${command}\` not found`)
  }
  // Ugly and not at all guaranteed to work, but still fun :)
  const str = definition.fn
    .toString()
    .replace(/^(async )?function[^(]*/, '') // strip leading function syntax
    .replace(/(\s*=>\s*|{)[\s\S]+/, '') // strip function block
    .replace(/^\s*\(|\)\s*$/g, '') // remove wrapping parentheses
    .replace(/\s+=\s+/g, '=') // remove whitespace next to =
    .trim() // trim leading & trailing whitespace
    .split(/\s*,\s*/) // split into argument array
    .join(' ')
  return leadingSpace && str.length ? ' ' + str : str
}

/**
 * Registers a command.
 * Command functions must be declared using ES5 syntax since context is bound
 * to `this` during execution.
 *
 * @param name - Command name used to call it.
 * @param description - Command description, displayed when running `help`.
 * @param fn - ES5 function to invoke when running command.
 * @returns Returns the same function passed as the `fn` argument.
 */
export function command<Fn extends CommandFn>(
  name: string,
  description: string,
  fn: Fn,
): Fn {
  commands[name] = { description, fn }
  return fn
}

export function textMemberCommand<Table extends TableName>(
  table: Table,
  textColumn: keyof EntityForTable<Table>,
  memberColumn: keyof EntityForTable<Table>,
) {
  async function resolveMember(
    ctx: CommandContext,
    res: EntityForTable<Table>,
  ) {
    const authors = res[memberColumn]!
    if (!authors || !Array.isArray(authors) || !authors.length) {
      return res
    }
    const author = enumValue(authors[0])
    const member = await ctx.backend.member(author)
    return Object.assign({}, res, { [memberColumn]: member })
  }

  return async function textMemberCmd(
    this: CommandContext,
    text = '',
    member = '',
  ) {
    // List existing rows when no text is provided
    if (!text || isInt(text)) {
      const rawRows = await this.backend.table(table)
      const slice = isInt(text)
        ? rawRows.slice(-parseInt(text, 10))
        : [rawRows[Math.floor(Math.random() * rawRows.length)]]
      const rows = await Promise.all(
        slice.map((row) => resolveMember(this, row)),
      )
      return f.list(rows)
    }

    // Create new row attributed to some member
    const resolvedMember = await this.backend
      .member(member || this.user)
      .catch((err) => {
        if (/Invalid member query/.test(err.message)) {
          return null
        }
        throw err
      })

    const data: any = {}
    data[textColumn] = text
    data[memberColumn] = resolvedMember && [resolvedMember._id]
    const record = await this.backend.create(table, data)
    return resolveMember(this, record)
  }
}

export function assertAdminUser(
  context: CommandContext,
): Promise<Member | undefined> {
  if (!context.user) {
    return Promise.resolve(undefined)
  }
  const message = `Only available to admins`
  return context.backend
    .member(context.user)
    .then((member) => {
      if (isAdmin(member)) {
        return Promise.resolve(member)
      }
      throw new Error(message)
    })
    .catch((err) => {
      if (/No member matching query/.test(err.message)) {
        throw new Error(message + ' (user not found)')
      }
      throw err
    })
}

// Re-export utility functions for convenience
export { isInt, toInt, clamp, rejectError }
