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
        <v-btn color="red" text><v-icon>fa-times</v-icon> &nbsp; Cancel</v-btn>
        <v-spacer />
        <v-btn color="primary" text @click="convert"><v-icon>fa-check</v-icon> &nbsp; Convert</v-btn>
      </v-list-item>
    </v-list>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
import { test } from '@/scripts/aws'
// const fs = remote.require('fs')
const path = remote.require('path')
const { dialog } = remote

export default {
  data () {
    return {
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
    convert () {
      test(this.path, this.output)
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
    }
  }
}
</script>
