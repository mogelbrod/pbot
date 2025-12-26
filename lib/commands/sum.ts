import { command } from '../command.js'
import list from './list.js'

export default command('sum', 'Alias of list', function (what = '-1') {
  // eslint-disable-next-line prefer-rest-params
  return list.apply(this, arguments as any)
})
