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
      </v-list-item>

      <v-list-item>
        <v-btn color="red" text><v-icon>fa-times</v-icon> &nbsp; Cancel</v-btn>
        <v-spacer />
        <v-btn color="primary" text><v-icon>fa-check</v-icon> &nbsp; Convert</v-btn>
      </v-list-item>
    </v-list>
  </v-card-text>
</template>

<script>
import { remote } from 'electron'
const path = remote.require('path')

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
    this.splitPath(this.path)
  },
  methods: {
    splitPath (p) {
      console.log(p)
      function evalPath (p) {
        const parent = path.dirname(p)
        if (!p || p === parent) return [p]
        return [...evalPath(parent), p]
      }

      this.parents = evalPath(p)
        .map(p => {
          return { text: path.basename(p) || 'root', to: this.path == p ? null : '/browse/' + p, exact: true }
        })
    }
  }
}
</script>
