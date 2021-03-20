<template>
  <v-card-text>
    <v-toolbar flat>
      <v-breadcrumbs :items="parents" divider="\" />

      <v-spacer />
    </v-toolbar>

    <v-divider />

    <v-list>
      <v-list-item>
        Please select output directory and click convert
      </v-list-item>

      <v-divider />

      <v-list-item>
        <v-text-field v-model="output" label="Output Directory" />
        <v-btn icon @click="selectOutput"><v-icon>fa-folder</v-icon></v-btn>
      </v-list-item>

      <v-list-item>
        <v-btn color="red" text @click="cancel"><v-icon>fa-times</v-icon> &nbsp; Cancel</v-btn>
        <v-spacer />
        <v-btn :loading="processing"
               color="primary" text @click="convert"
        >
          <v-icon>fa-check</v-icon> &nbsp; Searchable
        </v-btn>
        <v-btn :loading="processing"
               color="green" text @click="testPrint"
        >
          <v-icon>fa-check</v-icon> &nbsp; Render as Image
        </v-btn>
      </v-list-item>
    </v-list>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
import { queueFile } from '@/scripts/process_file'
import print from '@/scripts/print'
// const fs = remote.require('fs')
const path = remote.require('path')
const { dialog } = remote

export default {
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
