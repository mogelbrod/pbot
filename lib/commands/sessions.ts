import { command, isInt } from '../command.js'
import * as f from '../format.js'
import type { Output } from '../types.js'

export default command(
  'sessions',
  'Lists most recent/all sessions',
  async function (limit = '10') {
    let intLimit = parseInt(String(limit), 10)
    if (!isInt(intLimit) || intLimit < 0) {
      intLimit = 0
    }

    let sessions = await this.backend.table('Sessions', null, false)
    const rows: Output[] = []
    if (intLimit) {
      const total = sessions.length
      sessions = sessions.slice(-intLimit)
      if (intLimit < total) {
        rows.unshift(
          `Showing ${intLimit} of ${total} sessions (\`sessions all\` to see all)` as any,
        )
      }
    }
    rows.push(f.list(sessions))
    return rows
  },
)
