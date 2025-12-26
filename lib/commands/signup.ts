import { command } from '../command.js'
import { isAdmin } from '../backend.js'

export default command(
  'signup',
  'Registers a new member',
  function (email, name = '', role = 'Prospect') {
    const memberPromise = this.user
      ? this.backend.member(this.user).catch((err) => {
          if (/No member matching query/.test(err.message)) {
            return null
          }
          throw err
        })
      : Promise.resolve(null)

    return memberPromise
      .then((member) => {
        let discordId = null

        if (this.user && member && !name) {
          throw new Error(`${member.Name} already signed up`)
        }

        if (role !== 'Prospect' && !isAdmin(member!)) {
          throw new Error('Only admins are allowed to add other members')
        }

        // Use discord user data to fill out any missing inputs
        if (this.user && !member) {
          name ||= this.user.displayName || this.user.name
          discordId = this.user.name // TODO: Avoid assigning discordId if already set on another user
        }

        // Validate inputs
        if (
          !/^[A-Z0-9_+-]+(\.[A-Z0-9_+-]+)*@[A-Z0-9][A-Z0-9_-]*(\.[A-Z0-9_-]+)*\.[A-Z]{2,10}$/i.test(
            email,
          )
        ) {
          throw new Error('Invalid email address provided')
        }
        if (!name || name.length < 2) {
          throw new Error('Provide a name for the new member')
        }

        return this.backend
          .member(email)
          .then((existing) => {
            if (existing) {
              throw new Error(`${existing.Name} already signed up`)
            }
          })
          .catch((err) =>
            this.backend.create('Members', {
              Email: email,
              Name: name,
              Role: role,
              DiscordID: discordId,
              Joined: this.backend.date(new Date()),
            }),
          )
      })
      .then((res) => [['Added member', res]])
  },
)
