import { command, textMemberCommand } from '../command.js'

export default command(
  'quote',
  'Add or display a random quote',
  textMemberCommand('Quotes', 'Quote', 'Author'),
)
