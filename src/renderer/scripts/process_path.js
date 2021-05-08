import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import { queueFile } from './process_file'
const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf']

export default app => {
  const watchers = {}

  function validParent (searchName, dirName) {
    return searchName === '*' || path.basename(dirName).toLowerCase() === searchName.toLowerCase()
  }

  function createWatcher (watchers, pathInfo) {
    const watchPath = pathInfo.path
    const ignore = new RegExp(`(^|[/\\\\])((${pathInfo.original})|(${pathInfo.result}))[/\\\\]?$`)
    const watcher = chokidar.watch(watchPath, {
    //   ignored: new RegExp(`(^|[/\\\\])(${pathInfo.original})|(${pathInfo.result})[/\\\\]`)
    })

    watcher.on('add', async filePath => {
      console.log(`Event for ${filePath}`)
      if (filePath) {
        const parent = path.dirname(filePath)
        if (parent.match(ignore) ||
            !validParent(pathInfo.search, parent) ||
            !allowedTypes.includes(path.extname(filePath))) {
          console.log('Ignoring file ' + filePath + ' because of rule')
          app.context.store.commit('log',
            { path: pathInfo.path,
              text: 'Ignoring file ' + filePath + ' because of rule' })
          return
        }
        const moveTo = path.join(parent, pathInfo.original, path.basename(filePath))
        const resultTo = path.join(parent, pathInfo.result, path.basename(filePath) + '_output.pdf')

        app.context.store.commit('log',
          { path: pathInfo.path,
            text: 'Going to Process file ' + filePath + '\noriginal=' + moveTo + '\nresultTo = ' + resultTo })
        console.log(`going to process ${filePath} and going to move it to ${moveTo}`)
        // maybe send some notifications
        await fs.promises.mkdir(path.dirname(moveTo)).catch(_ => {})
        await fs.promises.mkdir(path.dirname(resultTo)).catch(_ => {})

        queueFile(filePath, resultTo, false, { originalPath: moveTo })
          .finally(() => fs.promises.rename(filePath, moveTo)
            .catch(err => console.log('Failed to move file', err)))
          .then(_ => {
            app.context.$dialog.notify.success('Processed file ' + filePath)
            app.context.store.commit('log',
              { path: pathInfo.path,
                text: 'Processed file ' + filePath + '\noriginal=' + moveTo + '\nresultTo = ' + resultTo })
          })
          .catch(err => {
            console.log('Processed file failed ' + filePath + '\nerror=', err)
            app.context.$dialog.notify.error('Processing file ' + filePath + ' failed!\nerror=' + err)
            app.context.store.commit('log',
              { path: filePath.info, text: 'Processed file failed ' + filePath + '\nerror=' + err })
          })
      }
    })
    console.log(`Created watcher for ${watchPath}`)

    watchers[watchPath] = watcher
  }
  const $this = {
    newPath: pathInfo => {
      app.context.$dialog.notify.info('Monitoring files for change in ' + pathInfo.path)
      app.context.store.commit('log', { path: pathInfo.path, text: 'Started monitoring path' })
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

      app.context.store.commit('log', { path: pathInfo.path, text: 'Stopped monitoring path' })
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
