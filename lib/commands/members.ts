import { command } from '../command.js'
import * as f from '../format.js'

export default command('members', 'Lists all members', async function () {
  const members = await this.backend.table('Members', null, false)
  return f.list(members)
})
