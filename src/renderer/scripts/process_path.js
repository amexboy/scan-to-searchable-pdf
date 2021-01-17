import fs from 'fs'
import path from 'path'
// import chokidar from 'chokidar'
// import { process_file } from './process_file'
const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf']

export default app => {
  const watchers = {}

  function validParent (searchName, dirName) {
    return searchName === '*' || path.basename(dirName) === searchName
  }

  function createWatcher (watchers, pathInfo) {
    const watchPath = pathInfo.path
    const watcher = fs.watch(watchPath, { encoding: 'utf8', recursive: true }, (eventType, filename) => {
      console.log(`Event ${eventType} for ${filename}`)
      if (filename) {
        const parent = path.dirname(filename)
        if (validParent(pathInfo.searchName, parent) && allowedTypes.includes(path.extname(filename))) {
          const moveToDir = path.join(parent, pathInfo.original)
          processFile(filename, moveToDir)
        }
      // Prints: <Buffer ...>
      }
    })
    console.log(`Created watcher for ${watchPath}`)

    watchers[watchPath] = watcher
  }

  function walk (loadPath, matchName, moveToDir) {
    fs.promises.readdir(loadPath)
      .then(files => {
        files.map(async file => {
          const filePath = path.join(loadPath, file)
          const moveToDirEffective = path.join(loadPath, moveToDir)

          const stat = await fs.promises.stat(filePath)
          if (!stat.isDirectory()) {
            return
          }
          // This is a directory
          if (validParent(matchName, filePath)) {
            processFilesIndDir(filePath, moveToDirEffective)
          } else {
            walk(filePath, matchName, moveToDir)
          }
        })
      })
  }

  async function processFilesIndDir (dir, moveToDir) {
    console.log('Going to process files in ' + dir + ' with allowed types ' + allowedTypes)
    const files = await fs.promises.readdir(dir)
    files
      .filter(file => allowedTypes.includes(path.extname(file)))
      .forEach(file => processFile(path.join(dir, file), moveToDir))
  }

  function processFile (path, moveToDir) {
    console.log(`going to process ${path} and going to move it to ${moveToDir}`)
    // maybe send some notifications
    app.context.$dialog.notify.success('Processed file ' + path)
  }

  const $this = {
    newPath: pathInfo => {
      app.context.$dialog.notify.info('Monitoring files for change in ' + pathInfo.path)
      createWatcher(watchers, pathInfo)
      walk(pathInfo.path, pathInfo.searchName || 'pdf', pathInfo.original || 'original')
    },
    deletePath: pathInfo => {
      app.context.dialog.notify.info('Stopped monitoring files for change in ' + pathInfo.path)
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
