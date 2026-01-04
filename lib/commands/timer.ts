import ms from 'ms'
import { command, rejectError } from '../command.js'
import * as f from '../format.js'

/** Map of timer ID to timeout handle for cleanup on completion or cancellation. */
const activeTimers = new Map<number, ReturnType<typeof setTimeout>>()
let currentTimerId = 0

export default command(
  'timer',
  'Sets a timer (duration=cancel cancels most recent)',
  function (duration = '2h', message = 'Timer ended') {
    if (duration === 'cancel') {
      // Get the most recently added timer (highest ID)
      const lastTimerId = currentTimerId
      const timeout = activeTimers.get(lastTimerId)
      if (timeout) {
        clearTimeout(timeout)
        activeTimers.delete(lastTimerId)
        return 'Cancelled most recent timer'
      } else {
        return 'No timers to cancel'
      }
    }

    const milliseconds = ms(duration as any) as unknown as number

    if (!milliseconds || milliseconds <= 1e3) {
      return rejectError(`Invalid timer duration ${f.code(duration)}`)
    }

    const timerId = ++currentTimerId
    const timeout = setTimeout(() => {
      // Clean up the timer from the map when it fires
      activeTimers.delete(timerId)
      this.output([[message, `(${duration})`]])
    }, milliseconds)

    activeTimers.set(timerId, timeout)

    return `Timer set: ${f.bold(duration)}`
  },
)
