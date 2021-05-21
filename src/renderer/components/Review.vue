<template>
  <v-card :loading="!ready || saving" :disabled="!ready || saving">
    <v-toolbar fixed>
      <v-row>
        <v-btn text small color="red" @click="close">
          <v-icon v-text="'mdi-close'" />
        </v-btn>
        <v-btn text small :disabled="pending.length == 0" @click="save">
          <v-icon color="primary" v-text="'mdi-content-save'" />
        </v-btn>
        <v-btn text small :disabled="pending.length == 0" @click="undo">
          <v-icon color="primary" v-text="'mdi-undo'" />
        </v-btn>
        <!-- <v-btn text small>
          <v-icon v-text="'mdi-reload'" />
        </v-btn> -->
        <v-spacer />
        <v-btn v-if="canEdit && !done" text small color="green" :disabled="!editable" @click="approveAllDialog">
          <v-icon v-text="'mdi-check-all'" /> &nbsp; Bulk Approveww
        </v-btn>
        <v-btn v-if="canEdit && done && pending.length === 0"
               small text :loading="saving" @click="finalize"
        >
          <v-icon v-text="'mdi-check-all'" /> &nbsp; Finalize
        </v-btn>
        <v-btn v-if="ready && editable && !hasLock" text small color="red"
               @click="forceLock"
        >
          <v-icon v-text="'mdi-lock-open'" /> &nbsp; Force Acquire Lock
        </v-btn>
        <v-spacer />
        <v-btn text small @click="toggleSort">
          <v-icon v-text="asc?'mdi-arrow-down':'mdi-arrow-up'" />
        </v-btn>
        <v-btn-toggle v-model="view" mandatory>
          <v-btn text small value="12">
            <v-icon v-text="'mdi-cards-variant'" />
          </v-btn>
          <v-btn text small value="6">
            <v-icon v-text="'mdi-view-grid'" />
          </v-btn>
        </v-btn-toggle>
      </v-row>
    </v-toolbar>
    <v-card-text v-if="!ready ">
      Please wait while the necessary data is loaded
    </v-card-text>
    <v-card-text v-else-if="canEdit && done && pending.length > 0">
      <v-row justify="center">
        {{ pending.length }} flagged words waiting saved. Save?
      </v-row>
      <v-row justify="center">
        <v-btn small text @click="save"><v-icon v-text="'mdi-content-save'" /> &nbsp; Save </v-btn>
      </v-row>
    </v-card-text>
    <v-card-text v-else-if="canEdit && done && pending.length === 0">
      <v-row justify="center">
        You have reviewed all flagged words. Proceed to re-generate the file?
      </v-row>
      <v-row justify="center">
        <v-btn small text :loading="saving"
               @click="finalize"
        >
          <v-icon v-text="'mdi-check-all'" /> &nbsp; Finalize
        </v-btn>
      </v-row>
    </v-card-text>
    <v-card-text v-else-if="ready && words.length > 0">
      <v-row style="max-height: 500px; overflow-y: scroll">
        <v-col v-for="word in words" :key="word.Id" cols="12" :sm="view">
          <v-card>
            <pdf-vue :key="word.Id" :editable="canEdit" :word="word"
                     :path="file.path" :cache-file="cacheFile" @save="saveWord"
            />
          </v-card>
        </v-col>
        <v-col>
          <infinite-loading @infinite="scroll" />
        </v-col>
      </v-row>
    </v-card-text>
    <v-pagination
      v-model="pg"
      :length="pglen"
      circle
    />
  </v-card>
</template>
<script>
import { hasLock, lock, approveWords, getFlaggedWords, unlock, finalizeFile } from '@/scripts/reviews'
import EditWord from '@/components/EditWord.vue'
import ApproveConfidence from '@/components/ApproveConfidence.vue'
import { splitPath } from '@/scripts/utils'
import InfiniteLoading from 'vue-infinite-loading'
import PdfVue from '@/components/PdfVue.vue'

export default {
  components: { PdfVue, InfiniteLoading },
  props: {
    file: {
      type: Object,
      require: true,
      default: () => ({ words: [] })
    },
    editable: {
      type: Boolean
    }
  },
  data () {
    return {
      asc: true,
      pg: 1,
      pglen: '',
      originalWords: [],
      corrections: [],
      cacheFile: null,
      isActive: false,
      autosave: false,
      saving: false,
      ready: false,
      pending: [],
      hasLock: false,
      view: 6,
      max: 5,
      search: '',
      headers: [{ text: 'File Name', value: 'name' },
        { text: 'Flagged Words', value: 'wordsCount' },
        { text: 'Actions', value: 'actions', sortable: false }
      ]
    }
  },
  computed: {
    words () {
      return this.originalWords
        .filter(w => !w.removed)
        .filter(w => w.Page == this.pg)
        .filter(w => !this.hideWordIds.includes(w.Id))
        .slice(0, this.max)
    },
    hideWordIds () {
      return [...this.correctionsIds, ...this.pendingWordIds]
    },
    pendingWordIds () {
      return this.pending.map(w => w.word.Id)
    },
    correctionsIds () {
      return this.corrections.map(c => c.wordId)
    },
    parents () {
      return this.file.path ? splitPath(this.file.path, true) : []
    },
    done () {
      return this.ready && this.words.length === 0
    },
    canEdit () {
      return this.editable && this.hasLock
    }
  },
  mounted () {
    this.init()
  },
  methods: {
    init () {
      const init = this.editable ? this.aqquireLock(false) : Promise.resolve(false)
      this.ready = false
      init.then(async () => {
        const res = await getFlaggedWords(this.file.path, this.file.extras.originalPath)
        console.log('Flagged words and corrections for file ', this.file.path, res)
        this.corrections = res.corrections
        this.originalWords = res.words
        this.pglen = res.words[res.words.length - 1].Page
        this.cacheFile = res.cacheFile
        this.ready = true
      })
        .catch(err => {
          console.log('Error loading', err)

          this.$dialog.notify.warning('Failed to load words ' + err.message)
          this.close()
        })
    },
    toggleSort () {
      this.asc = !this.asc

      this.originalWords.sort((a, b) => this.asc ? a.Page - b.Page : b.Page - a.Page)
      console.log(this.originalWords)
    },
    forceLock () {
      this.aqquireLock(true)
    },
    aqquireLock (force) {
      this.saving = true
      return lock(this.file.path, force)
        .then(({ success }) => {
          this.hasLock = success
        })
        .catch(err => {
          this.hasLock = false
          this.$dialog.notify.warning('Unable to aquire lock: ' + err.message)
        })
        .finally(_ => {
          this.saving = false
        })
    },
    close () {
      this.saving = true
      Promise.resolve(this.pending.length > 0)
        .then(pending => {
          if (pending) {
            return this.$dialog.confirm({
              text: `You have ${this.pending.length} unsaved items. You will loose your changes`,
              title: 'Are you sure?'
            })
          }

          return true
        })
        .then(async close => {
          if (close && this.hasLock) {
            return unlock(this.file.path).then(_ => true)
          }
          return close
        })
        .then(close => {
          console.log('Released lock', close)
          if (close) {
            this.$emit('submit', { cancel: true })
            this.isActive = false
          }
        })
    },
    saveWord (data) {
      if (!this.editable) {
        return
      }
      console.log(data)
      this.pending.push(data)
      // this.removeFromWords(data.word)
    },
    undo () {
      if (this.pending.length === 0) {
        return
      }
      this.pending.pop()
      // this.undoQueue.push()
    },
    removeFromWords (word) {
      const index = this.originalWords.indexOf(word)
      if (index >= 0) {
        this.originalWords.splice(index, 1)
      }
    },
    save () {
      this.saving = true
      hasLock(this.file.path)
        .then(res => {
          if (res) {
            return approveWords(this.file.path, this.pending)
          }

          throw new Error('You do not have lock')
        })
        .then(_ => {
          this.$dialog.notify.success('Changes were succesfully saved')
          this.pending = []
        })
        .then(this.init)
        .catch(err => {
          this.$dialog.notify.error(err.message)
        })
        .finally(_ => {
          this.saving = false
        })
    },
    finalize () {
      this.saving = true
      finalizeFile(this.file.path, this.file.extras)
        .then(_ => {
          this.close()
          this.$dialog.notify.success('Changes were succesfully saved')
        })
        .catch(err => {
          this.$dialog.notify.error(err.message)
        })
        .finally(_ => {
          this.saving = false
        })
    },
    scroll ($state) {
      console.log('scroll')
      this.max += 5
      if (this.max >= this.originalWords.length) {
        $state.complete()
      } else {
        $state.loaded()
      }
    },
    async edit (id) {
      const result = await this.$dialog.showAndWait(EditWord, { word: id.text })

      if (result && !result.cancel) {
        this.approve(id, result.update)
      }
    },
    async approveAllDialog () {
      this.saving = true
      const words = this.originalWords
      const result = await this.$dialog.showAndWait(ApproveConfidence, { confidence: 1 })

      if (result && !result.cancel) {
        const confidence = words.filter(w => w.Confidence > result.confidence)
        console.log('Words above confidence', confidence)

        const res = await this.$dialog.confirm({
          text: `Approve ${confidence.length} words above ${result.confidence}% confidence`,
          title: 'Are you sure?'
        })
        if (res) {
          confidence.forEach(w => {
            this.saveWord({ file: this.path, word: w, newWord: w.Text })// .then(_ => this.removeFromWords(w))
          })
          this.save()
            .then(_ => {
              this.saving = false
              this.$dialog.notify.success(`Approved all words aboove set confidence`)
            })
        } else {
          this.saving = false
        }
      } else {
        this.saving = false
      }
    }
  }
}
</script>
