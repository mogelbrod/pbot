import { command, rejectError } from '../command.js'

export default command(
  'member',
  'Displays user with the given name/email',
  function (query = '') {
    const member = query || this.user
    if (!member) {
      return rejectError(
        '`query` argument is required since user is missing from context',
      )
    }
    return this.backend.member(member)
  },
)
