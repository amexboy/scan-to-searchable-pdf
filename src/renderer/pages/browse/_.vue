<template>
  <v-card-text>
    <v-toolbar flat>
      <v-breadcrumbs :items="parents" divider="\" />

      <v-spacer />

      <v-btn icon>
        <v-icon>fa-search</v-icon>
      </v-btn>
      <v-btn icon @click="refresh"><v-icon>fa-redo</v-icon></v-btn>
    </v-toolbar>

    <v-divider />

    <v-list>
      <!-- <div class="e-nuxt-button" @click="openURL('https://electronjs.org/docs')">
      Electron.js
    </div> -->
      <v-list-item-group
        color="primary"
      >
        <v-list-item
          v-for="(item, i) in files"
          :key="i"
          :disabled="!item.enabled"
          :to="item.isFile ? '/convert/' + item.filePath : '/browse/' + item.filePath"
        >
          <v-list-item-icon>
            <v-icon color="primary">{{ item.icon }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ item.fileName }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list-item-group>
    </v-list>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
const fs = remote.require('fs')
const path = remote.require('path')

export default {
  data () {
    return {
      dialog: false,
      path: './',
      externalContent: '',
      parents: [],
      files: [],
      allowedTypes: ['.png', '.jpg', '.jpeg']
    }
  },
  mounted () {
    if (this.$route.params.pathMatch) {
      this.path = this.$route.params.pathMatch
    }
    this.path = path.resolve(path.normalize(this.path))
    this.refresh()
    this.splitPath(this.path)
  },
  methods: {
    openURL (url) {
      remote.shell.openExternal(url)
    },
    splitPath (p) {
      console.log(p)
      function evalPath (p) {
        const parent = path.dirname(p)
        if (!p || p === parent) return [p]
        return [...evalPath(parent), p]
      }

      this.parents = evalPath(p)
        .map(p => {
          return { text: path.basename(p) || 'root', to: '/browse/' + p, exact: true }
        })
    },
    refresh () {
      const loadPath = this.path
      const allowedTypes = this.allowedTypes
      // this.refresh()
      fs.promises.readdir(loadPath)
        // .then(dir => dir.read())
        .then(dirs => {
          return dirs
            .filter(file => {
              return file.substring(0, 1) !== '.'
            })
            .map(function (file) {
              const filePath = path.join(loadPath, file)
              const fileExt = path.extname(filePath) || ''

              return fs.promises.stat(filePath)
                .then(stats => {
                  return ({
                    fileName: file,
                    fileSize: stats.size,
                    isFile: stats.isFile(),
                    icon: stats.isFile() ? 'fa-file' : 'fa-folder',
                    fileType: stats.isFile() ? fileExt : 'Directory',
                    enabled: stats.isDirectory() || allowedTypes.includes(fileExt.toLowerCase()),
                    fileModified: stats.mtime.toLocaleString(),
                    filePath
                  })
                })
                .catch(e => {
                  console.log(e)
                  return {
                    fileName: file,
                    fileSize: 0,
                    isFile: false,
                    icon: 'fa-file',
                    fileType: 'Unknown',
                    enabled: false,
                    fileModified: 'N/A',
                    filePath
                  }
                })
            })
        })
        .then(promises => Promise.all(promises))
        .then(files => {
          console.log(files)
          this.files = files
        })
    }
  }
}
</script>
