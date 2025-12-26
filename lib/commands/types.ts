import { command } from '../command.js'
import * as f from '../format.js'
import { loadDrinkTypes } from '../drink-types.js'

export default command(
  'types',
  'List available drink types',
  async function () {
    const drinkTypes = await loadDrinkTypes(this.backend)
    return f.list(Object.values(drinkTypes))
  },
)
