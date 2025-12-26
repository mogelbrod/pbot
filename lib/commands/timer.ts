import ms from 'ms'
import { command, rejectError } from '../command.js'
import * as f from '../format.js'

// TODO: Either move this to airtable (yuck) or to the `this` context (requires
// context to be reused throughout script lifetime)
const activeTimers: any[] = []

export default command(
  'timer',
  'Sets a timer (duration=cancel cancels most recent)',
  function (duration = '2h', message = 'Timer ended') {
    if (duration === 'cancel') {
      const timeout = activeTimers.pop()
      if (timeout) {
        clearTimeout(timeout)
        return 'Cancelled most recent timer'
      } else {
        return 'No timers to cancel'
      }
    }

    const milliseconds = ms(duration as any) as unknown as number

    if (!milliseconds || milliseconds <= 1e3) {
      return rejectError(`Invalid timer duration ${f.code(duration)}`)
    }

    const timeout = setTimeout(() => {
      this.output([[message, `(${duration})`]])
    }, milliseconds)

    activeTimers.push(timeout)

    return `Timer set: ${f.bold(duration)}`
  },
)
