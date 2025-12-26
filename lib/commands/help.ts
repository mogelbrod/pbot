import { command, commands, functionToArgsString } from '../command.js'
import * as f from '../format.js'

export default command(
  'help',
  'Lists available commands',
  function (command = '') {
    if (command) {
      const description = commands[command]?.description
      if (description) {
        return [
          `Usage: ${f.code(`pbot ${command}${functionToArgsString(command)}`)} — ${f.escape(description)}`,
        ]
      } else {
        return [`Command not found: \`${command}\``]
      }
    }

    return [
      `Usage: ${f.code('pbot COMMAND [ARGS...]')}`,
      'Available commands:',
      f.list(
        Object.keys(commands)
          .sort((a, b) => a.localeCompare(b))
          .map((command) => {
            return (
              f.code(command + functionToArgsString(command)) +
              ' — ' +
              f.escape(commands[command].description)
            )
          }),
      ),
    ]
  },
)
