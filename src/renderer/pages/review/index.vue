<template>
  <v-card-text>
    <v-card>
      <v-data-table
        v-model="selected"
        :headers="headers"
        :items="files"
        :search="search"
        :loading="loading"
        item-key="name"
        single-expand
        show-expand
        show-select
      >
        <template #top>
          <v-toolbar flat extended>
            <v-toolbar-title>Flagged Files</v-toolbar-title>
            <v-spacer />
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search"
              single-line
              hide-details
            />
            <template #extension>
              <v-row>
                <v-btn small text @click="reload">
                  <v-icon>mdi-refresh</v-icon> &nbsp; Reload
                </v-btn>
                <v-spacer />
                <v-btn small text color="primary" :disabled="selected.length===0" @click="bulkApprove">
                  <v-icon>mdi-check-all</v-icon> &nbsp; Bulk Approve
                </v-btn>
              </v-row>
            </template>
          </v-toolbar>
        </template>
        <template #item.actions="{ item }">
          <v-row>
            <v-btn small text color="primary" @click="review(item)"><v-icon>mdi-eye-outline</v-icon></v-btn>
            <v-btn small text color="primary" @click="review(item, true)"><v-icon>mdi-pencil</v-icon></v-btn>
          </v-row>
        </template>
        <template #expanded-item="{ item }">
          <td :colspan="headers.length">
            <v-list
              dense
              subheader
              two-line
            >
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-subtitle v-text="'Path'" />
                  <v-list-item-title v-text="item.path" />
                </v-list-item-content>
              </v-list-item>

              <v-list-item>
                <v-list-item-content>
                  <v-list-item-subtitle v-text="'Output'" />
                  <v-list-item-title v-text="item.extras.output" />
                </v-list-item-content>
              </v-list-item>

              <v-list-item v-if="item.extras.originalPath">
                <v-list-item-content>
                  <v-list-item-subtitle v-text="'Original Path'" />
                  <v-list-item-title v-text="item.extras.originalPath" />
                </v-list-item-content>
              </v-list-item>

              <v-list-item>
                <!-- <v-btn small text color="green" @click="approveAllDialog(item.words)"> -->
                <!-- <v-icon v-text="'mdi-check'" />&nbsp; Bulk Approve -->
                <!-- </v-btn> -->
                <v-btn small text color="primary" @click="review(item)">
                  <v-icon v-text="'mdi-eye-outline'" />&nbsp; Review
                </v-btn>
                <v-spacer />
                <!-- <v-btn small text color="green"><v-icon v-text="'mdi-lock'" />&nbsp; Aquire Lock</v-btn>
                  <v-btn small text color="red"><v-icon v-text="'mdi-lock-open'" />&nbsp; Release Lock</v-btn> -->
              </v-list-item>
            </v-list>
          </td>
        </template>
      </v-data-table>
    </v-card>
  </v-card-text>
</template>
<script>
import path from 'path'
import { getFlagedFiles } from '@/scripts/reviews'
import Review from '@/components/Review.vue'
import BulkApprove from '@/components/BulkApprove.vue'

export default {
  data: () => {
    return {
      search: '',
      loading: true,
      selected: [],
      flagged: [],
      headers: [{ text: 'File Name', value: 'name' },
        { text: 'Flagged Words', value: 'flagsCount' },
        { text: 'Actions', value: 'actions', sortable: false }
      ]
    }
  },
  computed: {
    files () {
      return this.flagged.map(f => ({ name: path.basename(f.path), ...f }))
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    async review (file, editable) {
      await this.$dialog.showAndWait(Review, { layout: 'dialog', width: '90%', persistent: true, file, editable })
      this.reload()
    },
    reload () {
      this.loading = true
      getFlagedFiles()
        .then(flagged => {
          console.log(flagged)
          this.flagged = flagged || []
          this.loading = false
          return flagged
        })
    },
    async approveAll (file, conf) {

    },
    async bulkApprove () {
      console.log(this.selected)
      await this.$dialog.showAndWait(BulkApprove, {
        layout: 'dialog',
        width: '90%',
        persistent: true,
        files: this.selected
      })
      this.reload()
    }
  }
}
</script>
