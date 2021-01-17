import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import { processFile } from './process_file'
const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf']

export default app => {
  const watchers = {}

  function validParent (searchName, dirName) {
    return searchName === '*' || path.basename(dirName) === searchName
  }

  function createWatcher (watchers, pathInfo) {
    const watchPath = pathInfo.path
    const watcher = chokidar.watch(watchPath, {
      ignored: new RegExp(`(^|[/\\\\])(${pathInfo.original})|(${pathInfo.result})[/\\\\]`)
    })

    watcher.on('add', async filePath => {
      console.log(`Event for ${filePath}`)
      if (filePath) {
        const parent = path.dirname(filePath)
        if (validParent(pathInfo.searchName, parent) && allowedTypes.includes(path.extname(filePath))) {
          const moveTo = path.join(parent, pathInfo.original, path.basename(filePath))
          const resultTo = path.join(parent, pathInfo.result, path.basename(filePath), '.pdf')

          console.log(`going to process ${filePath} and going to move it to ${moveTo}`)
          // maybe send some notifications
          await fs.promises.mkdir(path.dirname(moveTo)).catch(err => console.log(err))
          await fs.promises.mkdir(path.dirname(resultTo)).catch(err => console.log(err))

          processFile(filePath, path.extname(filePath), resultTo)
            .then(() => fs.promises.rename(filePath, moveTo))
            .then(_ => {
              app.context.$dialog.notify.success('Processed file ' + filePath)
            })
        }
      }
    })
    console.log(`Created watcher for ${watchPath}`)

    watchers[watchPath] = watcher
  }
  const $this = {
    newPath: pathInfo => {
      app.context.$dialog.notify.info('Monitoring files for change in ' + pathInfo.path)
      createWatcher(watchers, pathInfo)
    },
    deletePath: pathInfo => {
      app.context.$dialog.notify.info('Stopped monitoring files for change in ' + pathInfo.path)
      const path = pathInfo.path
      console.log(`Removing deleted item from watcher ${path}`)
      const watcher = watchers[path]
      if (watcher) {
        watcher.close()
        delete watchers[path]
      }

      app.context.$dialog.notify.info('Stopped monitoring files for change in ' + pathInfo.path)
      console.log('Closed watcher for ' + path)
    },

    updatePath (pathInfo) {
      $this.deletePath(pathInfo)
      $this.newPath(pathInfo)
    }

  }

  return $this
}
