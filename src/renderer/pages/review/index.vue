<template>
  <v-card-text>
    <v-col>
      <v-card>
        <v-data-table
          :headers="headers"
          :items="files"
          :search="search"
          single-expand
          show-expand
        >
          <template #top>
            <v-toolbar flat>
              <v-toolbar-title>Flagged Files</v-toolbar-title>
              <v-spacer />
              <v-text-field
                v-model="search"
                append-icon="mdi-magnify"
                label="Search"
                single-line
                hide-details
              />
            </v-toolbar>
          </template>
          <template #item.actions="{ item }">
            <v-row>
              <!-- <v-btn small text color="red"><v-icon>mdi-lock</v-icon></v-btn> -->
              <!-- <v-btn small text color="green" @click="approveAllDialog(item.words)">
                <v-icon>mdi-check</v-icon></v-btn> -->
              <v-btn small text color="primary" @click="review(item)"><v-icon>mdi-eye-outline</v-icon></v-btn>
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
                    <v-list-item-subtitle v-text="'Input'" />
                    <v-list-item-title v-text="item.input" />
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
    </v-col>
  </v-card-text>
</template>
<script>
import path from 'path'
import { getFlagedFiles, approveWord } from '@/scripts/reviews'
import EditWord from '@/components/EditWord.vue'
import ApproveConfidence from '@/components/ApproveConfidence.vue'
import Review from '@/components/Review.vue'

export default {
  data: () => {
    return {
      search: '',
      flagged: [],
      headers: [{ text: 'File Name', value: 'name' },
        { text: 'Flagged Words', value: 'wordsCount' },
        { text: 'Actions', value: 'actions', sortable: false }
        // { text: 'Path', value: 'path' },
        // { text: 'Input', value: 'input' },
        // { text: 'Output', value: 'output' }
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
    async review (file) {
      await this.$dialog.showAndWait(Review, { layout: 'dialog', width: '90%', persistent: true, file })
      this.reload()
    },
    reload () {
      getFlagedFiles()
        .then(flagged => {
          console.log(flagged)
          this.flagged = flagged || []
          return flagged
        })
    }
  }
}
</script>
