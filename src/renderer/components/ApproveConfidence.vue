<template>
  <v-form ref="form">
    <v-card>
      <v-toolbar dark color="primary">
        Please enter the temporary minimum confidence
      </v-toolbar>
      <v-card-text>
        <v-list>
          <v-list-item>
            <v-text-field v-model="value" label="Minimum Confidence"
                          :rules="[i => !!i || 'Required']"
            />
          </v-list-item>

          <v-list-item v-if="lock">
            <v-switch
              v-model="forceLock"
              label="Force Acquire Lock"
            />
          </v-list-item>
          <v-divider />
        </v-list>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn color="red" text @click="cancel"><v-icon small>fa-times</v-icon> &nbsp; Cancel</v-btn>
        <v-spacer />
        <v-btn color="primary" text @click="save">
          <v-icon small>fa-check</v-icon> &nbsp; Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-form>
</template>
<script>
export default {
  props: {
    confidence: { required: false, type: Number, default: 0 },
    lock: { required: false, type: Boolean, default: false }
  },
  data () {
    return {
      isActive: false,
      value: this.confidence,
      forceLock: false
    }
  },
  methods: {
    cancel () {
      this.isActive = false
      this.$emit('submit', { cancel: true })
    },
    save () {
      if (!this.$refs.form.validate()) {
        return
      }
      this.$emit('submit', { confidence: this.value, forceLock: this.forceLock })
      this.isActive = false
    }
  }
}
</script>
