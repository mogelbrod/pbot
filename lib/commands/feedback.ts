import { command, textMemberCommand } from '../command.js'

export default command(
  'feedback',
  'Register or display feedback',
  textMemberCommand('Feedback', 'Feedback', 'Author'),
)
