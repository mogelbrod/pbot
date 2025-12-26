import { command, isInt, rejectError } from '../command.js'
import * as f from '../format.js'

export default command(
  'drink',
  'Registers a drink for a member',
  async function (volume = '40', type = 'Beer', member = '') {
    if (!member && !this.user) {
      return rejectError(`A member must be provided`)
    }

    const intVolume = parseInt(volume, 10)

    if (!isInt(volume) || intVolume === 0 || intVolume > 3e3) {
      return rejectError(`Invalid volume \`${volume}\``)
    }

    const isModifier = volume[0] === '+' || volume[0] === '-'

    const [session, memberRecord] = await Promise.all([
      this.backend.session(),
      this.backend.member(member || this.user),
    ])

    // Simply create new drink record
    if (!isModifier) {
      const drink = await this.backend.create('Drinks', {
        Time: new Date().toISOString(),
        Sessions: [session._id],
        Members: [memberRecord._id],
        Volume: intVolume,
        Type: f.capitalize(type),
      })
      return [['Registered', drink, 'to', memberRecord]]
    }

    const memberId =
      this.config.backend === 'baserow' ? memberRecord._id : memberRecord.Email

    const [drinkRecord] = await this.backend.table('Drinks', {
      filterByFormula: `${memberRecord._type} = '${memberId}'`,
      maxRecords: 1,
      sort: [{ field: 'Time', direction: 'desc' }],
    })
    if (!drinkRecord) {
      throw new Error(
        `${f.escape(memberRecord.Name)} doesn't appear to have any drinks to modify`,
      )
    }

    const newVolume = parseInt(drinkRecord.Volume as any, 10) + intVolume
    const deleted = newVolume <= 0
    const updatedDrink = await this.backend[deleted ? 'delete' : 'update'](
      'Drinks',
      drinkRecord._id!,
      deleted ? (undefined as any) : { Volume: newVolume },
    )
    return [
      [
        deleted ? 'Deleted' : 'Updated',
        deleted ? drinkRecord : updatedDrink,
        `(${intVolume >= 0 ? '+' : ''}${intVolume}) belonging to`,
        memberRecord,
      ],
    ]
  },
)
