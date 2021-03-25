<template>
  <canvas />
</template>

<script>
import { remote } from 'electron'
import { queueFile } from '@/scripts/process_file'
import print from '@/scripts/print'
// const fs = remote.require('fs')
const path = remote.require('path')
const { dialog } = remote

export default {
  layout: 'empty',
  data () {
    return {
      processing: false,
      output: '',
      path: './',
      externalContent: '',
      parents: [
      ]
    }
  },
  mounted () {
    if (this.$route.params.pathMatch) {
      this.path = this.$route.params.pathMatch
    }
    this.path = path.resolve(path.normalize(this.path))
    this.output = `${this.path}_converted.pdf`
    this.splitPath(this.path)
  },
  methods: {
    testPrint () {
      print(this.path, this.output)
    },
    convert () {
      this.processing = true
      queueFile(this.path, path.extname(this.path), this.output)
        .then(res => {
          this.processing = false
          console.log(res)
          this.$dialog.notify.success(`Processed ${this.path} file succesfully`, { timeout: 0 })
        })
        .catch(err => {
          this.processing = false
          this.$dialog.notify.error(`Processing ${this.path} failed due to ${err}`, { timeout: 0 })
        })
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
          return { text: path.basename(p) || 'root', to: this.path === p ? null : '/browse/' + p, exact: true }
        })
    },
    selectOutput (p) {
      const defaultPath = (typeof p === 'string') ? p : this.output
      // const fileName = path.basename(this.path)
      dialog.showSaveDialog({ defaultPath, properties: [] })
        .then(res => {
          if (res.canceled) {
            console.log('File selection canceled')
            return defaultPath
          }

          return res.filePath
        })
        .then(p => {
          return path.resolve(p)
        })
        .then(p => {
          console.log(p)
          this.output = p
        })
    },
    cancel () {
      this.$router.push(`/browse/${path.dirname(this.path)}`)
    }
  }
}
</script>
