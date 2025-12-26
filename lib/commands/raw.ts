import { command, execute } from '../command.js'

export default command(
  'raw',
  'Executes the given input without formatting its output',
  function (...cmd) {
    return execute.call(this, cmd).then((raw) => ({
      _type: 'RawResult',
      raw,
    }))
  },
)
