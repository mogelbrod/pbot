import { command } from '../command.js'
import { loadDrinkTypes } from '../drink-types.js'
import type { TableName } from '../types.js'

export default command('reload', 'Reloads data', async function (...tables) {
  await Promise.all([
    this.backend.tables(false, ...(tables as TableName[])),
    loadDrinkTypes(this.backend),
  ])
  return `Reloaded tables ${tables.join(', ')}`
})
