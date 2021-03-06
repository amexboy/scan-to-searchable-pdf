import processPath from '@/scripts/process_path.js'
import { dbFactory } from '@/scripts/db'

export default ({ app }) => {
  const paths = dbFactory('continious-process.db')
  const { newPath, updatePath, deletePath } = processPath(app)

  paths.on('update', (datastore, result, query, pathInfo, options) => {
    console.log('Update regarding ' + pathInfo.path)
    updatePath(pathInfo)
  })

  paths.on('insert', (datastore, result, pathInfo) => {
    console.log('Insert regarding ' + pathInfo.path)
    newPath(pathInfo)
  })
  paths.on('remove', (datastore, result, pathInfo, options) => {
    console.log('Remove regarding ' + pathInfo.path)
    deletePath(pathInfo)
  })
  paths.find({}).then(processes => {
    processes.forEach(newPath)
  })
}
