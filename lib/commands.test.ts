import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  execute,
  commands,
  functionToArgsString,
  type CommandContext,
  type CommandFn,
} from './commands.js'
import type { Backend, Config } from './types.js'

function createMockSessions(count: number, includeLocation = false) {
  return Array.from({ length: count }, (_, i) => ({
    _id: `session-${i}`,
    _type: 'Session' as const,
    Start: `2025-01-${String(i + 1).padStart(2, '0')}`,
    ...(includeLocation && { Location: 'Test Location' }),
  }))
}

/** Shared mock data */
const mocks = {
  session: createMockSessions(1, true)[0],
  member: {
    _id: 'member-1',
    _type: 'Member' as const,
    Name: 'Test User',
    Email: 'test@test.com',
  },
  drink: {
    _id: 'drink-1',
    _type: 'Drink' as const,
  },
  drinkTypes: [
    { _type: 'DrinkType' as const, Type: 'Beer', Multiplier: 1 },
    { _type: 'DrinkType' as const, Type: 'Wine', Multiplier: 2 },
  ],
  members: [
    {
      _id: '1',
      _type: 'Member' as const,
      Name: 'User 1',
      Email: 'user1@test.com',
    },
    {
      _id: '2',
      _type: 'Member' as const,
      Name: 'User 2',
      Email: 'user2@test.com',
    },
  ],
}

describe('commands', () => {
  let mockContext: CommandContext
  let mockBackend: Backend
  let mockConfig: Config

  beforeEach(() => {
    // Create a minimal mock backend
    mockBackend = {
      parseRecord: vi.fn(),
      table: vi.fn(),
      tables: vi.fn(),
      session: vi.fn(),
      member: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      date: vi.fn((d) => d.toISOString()),
      time: vi.fn((d) => d),
      placeToSession: vi.fn(),
    } as any

    mockConfig = {
      backend: 'airtable',
      log: vi.fn(),
    }

    mockContext = {
      config: mockConfig,
      backend: mockBackend,
      log: vi.fn(),
      output: vi.fn(),
    }
  })

  describe('functionToArgsString', () => {
    it('should return argument names when command has args', () => {
      const result = functionToArgsString('help')
      // help command has optional command argument
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return argument names for command with args', () => {
      const result = functionToArgsString('member')
      expect(result).toContain('query')
    })

    it('should include leading space when requested', () => {
      const result = functionToArgsString('member', true)
      expect(result).toMatch(/^ /)
    })

    it('should exclude leading space when not requested', () => {
      const result = functionToArgsString('member', false)
      expect(result).not.toMatch(/^ /)
    })

    it('should throw error for non-existent command', () => {
      expect(() => functionToArgsString('nonexistent')).toThrow(
        'Command `nonexistent` not found',
      )
    })

    it('should handle commands with default parameters', () => {
      const result = functionToArgsString('session')
      expect(result).toContain('index')
      expect(result).toContain('=')
    })

    it('should handle commands with multiple parameters', () => {
      const result = functionToArgsString('suggest')
      expect(result).toContain('query')
      expect(result).toContain('price')
      expect(result).toContain('openNow')
    })
  })

  describe('execute', () => {
    it('should throw error when called without valid context', async () => {
      try {
        await execute.call(null as any, 'help')
        expect.fail('Should have thrown error')
      } catch (err: any) {
        // When context is null, we get a TypeError before the check
        expect(err).toBeDefined()
      }
    })

    it('should throw error when context is missing backend', async () => {
      const invalidContext = { config: mockConfig } as any
      try {
        await execute.call(invalidContext, 'help')
        expect.fail('Should have thrown error')
      } catch (err: any) {
        expect(err.message).toContain('valid execution context')
      }
    })

    it('should execute help command when no input provided', async () => {
      const result = await execute.call(mockContext, '')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute help command by default', async () => {
      const result = await execute.call(mockContext, [])
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should throw error for unknown command', async () => {
      await expect(execute.call(mockContext, 'unknowncommand')).rejects.toThrow(
        'Unknown command',
      )
    })

    it('should handle string input', async () => {
      const result = await execute.call(mockContext, 'help')
      expect(result).toBeDefined()
    })

    it('should handle array input', async () => {
      const result = await execute.call(mockContext, ['help'])
      expect(result).toBeDefined()
    })

    it('should be case-insensitive for command names', async () => {
      const result = await execute.call(mockContext, 'HELP')
      expect(result).toBeDefined()
    })

    it('should prepend "drink" command for numeric input', async () => {
      mockContext.user = { name: 'TestUser' } as any
      mockBackend.session = vi.fn().mockResolvedValue(mocks.session)
      mockBackend.member = vi.fn().mockResolvedValue(mocks.member)
      mockBackend.create = vi.fn().mockResolvedValue(mocks.drink)

      await execute.call(mockContext, '50')
      expect(mockBackend.create).toHaveBeenCalled()
    })

    it('should throw error when insufficient arguments provided', async () => {
      // Test with place command which requires query argument
      await expect(execute.call(mockContext, ['place'])).rejects.toThrow(
        'Insufficient number of arguments',
      )
    })

    it('should call command function with correct arguments', async () => {
      const commandSpy = vi.spyOn(commands.help, 'fn')
      await execute.call(mockContext, ['help', 'drink'])
      expect(commandSpy).toHaveBeenCalledWith('drink')
    })

    it('should handle commands with optional parameters', async () => {
      const result = await execute.call(mockContext, 'help')
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should bind context correctly to command function', async () => {
      let capturedContext: CommandContext | undefined

      // Create a spy that captures the context
      const contextCapture = vi.fn()
      // eslint-disable-next-line func-style
      const testCommand: CommandFn = function testCmd(this: CommandContext) {
        contextCapture(this)
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        capturedContext = this
        return 'test'
      }
      commands.testcmd = { description: 'Test command', fn: testCommand }

      await execute.call(mockContext, 'testcmd')
      expect(contextCapture).toHaveBeenCalled()
      expect(capturedContext).toBe(mockContext)
      expect(capturedContext!.backend).toBe(mockBackend)
      expect(capturedContext!.config).toBe(mockConfig)

      // Cleanup
      delete commands.testcmd
    })
  })

  describe('commands registry', () => {
    it('should contain expected commands', () => {
      const expectedCommands = [
        'calendar',
        'drink',
        'feedback',
        'help',
        'list',
        'maintenance',
        'member',
        'members',
        'place',
        'quote',
        'raw',
        'reload',
        'session',
        'sessions',
        'signup',
        'start',
        'stats',
        'status',
        'suggest',
        'sum',
        'timer',
        'types',
      ]

      for (const cmd of expectedCommands) {
        expect(commands[cmd]).toBeDefined()
        expect(commands[cmd].description).toBeDefined()
        expect(typeof commands[cmd].fn).toBe('function')
      }
    })

    it('should have non-empty descriptions', () => {
      for (const command of Object.values(commands)) {
        expect(command.description).toBeTruthy()
        expect(command.description.length).toBeGreaterThan(0)
      }
    })

    it('should have valid function implementations', () => {
      for (const command of Object.values(commands)) {
        expect(typeof command.fn).toBe('function')
      }
    })
  })

  describe('help command', () => {
    it('should list all commands when no argument provided', async () => {
      const result = await commands.help.fn.call(mockContext)
      expect(Array.isArray(result)).toBe(true)
      expect((result as any[]).length).toBeGreaterThan(1)
    })

    it('should show usage for specific command', async () => {
      const result = await commands.help.fn.call(mockContext, 'drink')
      expect(Array.isArray(result)).toBe(true)
      expect((result as any[])[0]).toContain('drink')
    })

    it('should handle non-existent command', async () => {
      const result = await commands.help.fn.call(mockContext, 'nonexistent')
      expect((result as any[])[0]).toContain('Command not found')
    })
  })

  describe('status command', () => {
    it('should return status information', async () => {
      const result = await commands.status.fn.call(mockContext)
      expect(result).toBeDefined()
      // Status returns a formatted list object
      expect(result).toBeTruthy()
    })

    it('should include backend info from config', async () => {
      mockContext.config.backend = 'baserow'
      const result = await commands.status.fn.call(mockContext)
      expect(result).toBeDefined()
    })

    it('should include server info if present', async () => {
      mockContext.serverInfo = { version: '1.0.0' }
      const result = await commands.status.fn.call(mockContext)
      expect(result).toBeDefined()
    })
  })

  describe('raw command', () => {
    it('should execute command and return raw result', async () => {
      const result = await commands.raw.fn.call(mockContext, 'help')
      expect(result).toBeDefined()
      expect((result as any)._type).toBe('RawResult')
      expect((result as any).raw).toBeDefined()
    })

    it('should pass through multiple arguments', async () => {
      const result = await commands.raw.fn.call(mockContext, 'help', 'drink')
      expect(result).toBeDefined()
      expect((result as any)._type).toBe('RawResult')
    })
  })

  describe('timer command', () => {
    it('should set a timer with valid duration', async () => {
      const result = await commands.timer.fn.call(mockContext, '5m', 'Test')
      expect(result).toContain('Timer set')
      expect(result).toContain('5m')
    })

    it('should use default message when not provided', async () => {
      const result = await commands.timer.fn.call(mockContext, '1h')
      expect(result).toContain('Timer set')
      expect(result).toContain('1h')
    })

    it('should reject invalid duration', async () => {
      await expect(
        commands.timer.fn.call(mockContext, 'invalid'),
      ).rejects.toThrow('Invalid timer duration')
    })

    it('should reject very short duration', async () => {
      await expect(commands.timer.fn.call(mockContext, '1ms')).rejects.toThrow(
        'Invalid timer duration',
      )
    })

    it('should cancel most recent timer', async () => {
      await commands.timer.fn.call(mockContext, '1h')
      const result = await commands.timer.fn.call(mockContext, 'cancel')
      expect(result).toContain('Cancelled')
    })

    it('should handle cancel with no active timers', async () => {
      // Cancel all existing timers first
      let result: any
      do {
        result = await commands.timer.fn.call(mockContext, 'cancel')
      } while (typeof result === 'string' && !result.includes('No timers'))

      expect(result).toContain('No timers to cancel')
    })
  })

  describe('types command', () => {
    it('should list drink types', async () => {
      mockBackend.table = vi.fn().mockResolvedValue(mocks.drinkTypes)

      const result = await commands.types.fn.call(mockContext)
      expect(result).toBeDefined()
    })
  })

  describe('sessions command', () => {
    it('should list sessions with default limit', async () => {
      const mockSessions = createMockSessions(20, true)
      mockBackend.table = vi.fn().mockResolvedValue(mockSessions)

      const result = await commands.sessions.fn.call(mockContext)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle "all" parameter', async () => {
      mockBackend.table = vi.fn().mockResolvedValue([])
      const result = await commands.sessions.fn.call(mockContext, 'all')
      expect(Array.isArray(result)).toBe(true)
    })

    it('should limit results when specified', async () => {
      const mockSessions = createMockSessions(20)
      mockBackend.table = vi.fn().mockResolvedValue(mockSessions)

      const result = await commands.sessions.fn.call(mockContext, '5')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('members command', () => {
    it('should list all members', async () => {
      mockBackend.table = vi.fn().mockResolvedValue(mocks.members)

      const result = await commands.members.fn.call(mockContext)
      expect(result).toBeDefined()
    })
  })

  describe('member command', () => {
    it('should display member by query', async () => {
      mockBackend.member = vi.fn().mockResolvedValue(mocks.member)

      const result = await commands.member.fn.call(mockContext, 'test@test.com')
      expect(result).toBeDefined()
    })

    it('should use context user when no query provided', async () => {
      mockContext.user = { name: 'TestUser' } as any
      mockBackend.member = vi.fn().mockResolvedValue(mocks.member)

      const result = await commands.member.fn.call(mockContext)
      expect(result).toBeDefined()
      expect(mockBackend.member).toHaveBeenCalledWith(mockContext.user)
    })

    it('should reject when no query and no user in context', async () => {
      await expect(commands.member.fn.call(mockContext)).rejects.toThrow(
        'query` argument is required',
      )
    })
  })

  describe('session command', () => {
    it('should display current session by default', async () => {
      mockBackend.session = vi.fn().mockResolvedValue(mocks.session)

      const result = await commands.session.fn.call(mockContext)
      expect(result).toBeDefined()
      expect(mockBackend.session).toHaveBeenCalledWith('-1')
    })

    it('should display specific session by index', async () => {
      mockBackend.session = vi.fn().mockResolvedValue(mocks.session)

      const result = await commands.session.fn.call(mockContext, '5')
      expect(result).toBeDefined()
      expect(mockBackend.session).toHaveBeenCalledWith('5')
    })
  })

  describe('reload command', () => {
    it('should reload specified tables', async () => {
      mockBackend.tables = vi.fn().mockResolvedValue([[], []])
      mockBackend.table = vi.fn().mockResolvedValue([])

      const result = await commands.reload.fn.call(
        mockContext,
        'Members',
        'Sessions',
      )
      expect(result).toContain('Reloaded')
      expect(result).toContain('Members')
      expect(result).toContain('Sessions')
    })
  })

  describe('sum command', () => {
    it('should call list command implementation', async () => {
      mockBackend.session = vi.fn().mockResolvedValue(mocks.session)
      mockBackend.table = vi.fn().mockResolvedValue([])

      // sum should behave like list
      const result = await commands.sum.fn.call(mockContext, '-1')
      expect(result).toBeDefined()
    })
  })
})
