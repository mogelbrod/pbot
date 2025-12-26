import { command } from '../command.js'

export default command(
  'session',
  'Displays the given/current session',
  function (index = '-1') {
    return this.backend.session(index)
  },
)
