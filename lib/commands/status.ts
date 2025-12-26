import { command } from '../command.js'
import * as f from '../format.js'

const startTime = Date.now()

export default command(
  'status',
  'Displays pbot status information',
  function () {
    const data = {
      Started: f.date(startTime, true),
      Backend: this.config.backend,
      ...this.serverInfo,
    }
    return f.list(
      Object.entries(data).map(
        (item) => f.bold(item[0] + ':') + ' ' + f.fancy(item[1]),
      ),
    )
  },
)
