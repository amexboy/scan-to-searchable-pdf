<template>
  <v-card>
    <v-toolbar fixed>
      <v-toolbar-title>Bulk Approve</v-toolbar-title>
      <v-spacer />
      <v-btn text small color="red" @click="close">
        <v-icon v-text="'mdi-close'" />
      </v-btn>
    </v-toolbar>
    <v-card-text>
      <v-row>
        <v-col cols="12" sm="9">
          <v-row>
            <v-text-field v-model="confidence" label="Minimum Confidence"
                          :rules="[i => !!i || 'Required']"
            />
            <v-spacer />
            <v-switch
              v-model="forceLock"
              label="Force Acquire Lock"
            />
          </v-row>
        </v-col>
        <v-col align="end" align-self="center">
          <v-btn :loading="running"
                 :disabled="done"
                 text
                 @click="run"
          >
            <v-icon v-text="'mdi-run'" /> &nbsp; Start
          </v-btn>
        </v-col>
      </v-row>
      <v-simple-table>
        <template #default>
          <thead>
            <tr>
              <th class="text-left">
                File
              </th>
              <th class="text-left">
                Number of words
              </th>
              <th class="text-left">
                Finalized
              </th>
              <th class="text-left">
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in progress"
              :key="item.path"
            >
              <td>{{ item.path }}</td>
              <td>{{ item.wordsCount }}</td>
              <td>{{ item.finalized }}</td>
              <td>{{ item.status?item.status.status:'Starting' }}</td>
            </tr>
          </tbody>
        </template>
      </v-simple-table>
    </v-card-text>
  </v-card>
</template>
<script>
import { lock, approveWords, getFlaggedWords, unlock, finalizeFile } from '@/scripts/reviews'

export default {
  props: {
    files: {
      type: Array,
      require: true,
      default: () => []
    }
  },
  data () {
    return {
      confidence: 1,
      forceLock: false,
      running: false,
      currentFile: null,
      numberOfWords: {},
      finalize: {},
      finalStatus: {},
      done: false
    }
  },
  computed: {
    progress () {
      return this.files.map(f => {
        const wordsCount = this.numberOfWords[f.path]
        const finalized = this.finalize[f.path]
        const status = this.finalStatus[f.path]

        return ({ ...f,
          wordsCount,
          finalized,
          status
        })
      }
      )
    }
  },
  mounted () {
  },
  methods: {
    async run () {
      if (!this.confidence) {
        return
      }

      const res = await this.$dialog.confirm({
        text: `Approve ${this.files.length} files for flagged words above ${this.confidence}% confidence`,
        title: 'Are you sure?'
      })

      if (!res) {
        return
      }

      this.running = true

      Promise.all(
        this.files.map(async f => {
          return lock(f.path, this.forceLock)
            .then(res => {
              if (!res.success) {
                throw new Error('Could not aquire lock')
              }
            })
            .then(async _ => {
              this.$set(this.finalStatus, f.path, { finished: false, status: 'Lock Acquired' })
              const flags = await getFlaggedWords(f.path)
              const filtered = flags.words.filter(f => f.Confidence > this.confidence)
              this.numberOfWords[f.path] = flags.words.length

              this.$set(this.numberOfWords, f.path, filtered.length + '/' + flags.words.length)
              this.$set(this.finalize, f.path, flags.words.length <= flags.corrections.length + filtered.length)
              this.$set(this.finalStatus, f.path, { finished: false, status: 'Fetched data' })

              return { filtered, flags }
            })
            .then(flags => {
              return approveWords(f.path, flags.filtered.map(w => ({ word: w, newWord: w.Text })))
                .then(_ => {
                  this.$set(this.finalStatus, f.path, { finished: false, status: 'Saved approval' })
                  console.log('Finalize', this.finalize[f.path])
                  if (this.finalize[f.path]) {
                    return finalizeFile(f.path, f.extras)
                  }
                })
            })
            .then(_ => unlock(f.path))
            .then(_ => {
              console.log('Finished processing' + f.path, _)
              this.$set(this.finalStatus, f.path,
                { success: true, finished: true, status: this.finalize[f.path] ? 'Finalize' : 'Done' })
            })
            .catch(err => {
              console.log('Failed processing ' + f.path, err)
              this.$set(this.finalStatus, f.path, { success: false, finished: true, status: err.message })
            })
        })
      )
        .then(_ => {
          this.$dialog.notify.success('Done processing all files')
          this.close()
        })
        .catch(_ => {
          this.$dialog.notify.error('Some files failed processing ')
        })
        .finally(_ => {
          this.running = false
          this.done = true
        })
    },
    close () {
      this.$emit('submit', { cancel: true })
    }
  }
}
</script>
