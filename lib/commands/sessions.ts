import { command, toInt } from '../command.js'
import * as f from '../format.js'
import type { Output } from '../types.js'

export default command(
  'sessions',
  'Lists most recent/all sessions',
  async function (limit = '10') {
    let intLimit = toInt(limit, 0)
    if (intLimit < 0) intLimit = 0

    const sessions = await this.backend.table('Sessions', null, false)
    sessions.reverse() // List most recent first

    const rows: Output[] = []

    if (intLimit > 0 && sessions.length > intLimit) {
      const total = sessions.length
      sessions.length = intLimit
      rows.unshift(
        f.italic(
          `Showing ${intLimit} of ${total} sessions - \`sessions all\` to see all)`,
        ),
      )
    }

    rows.push(f.list(sessions))
    return rows
  },
)
