<template>
  <v-form ref="form">
    <v-card>
      <v-toolbar dark color="primary">
        Please enter the temporary minimum confidence
      </v-toolbar>
      <v-card-text>
        <v-list>
          <v-divider />

          <v-list-item>
            <v-text-field v-model="value" label="Minimum Confidence"
                          :rules="[i => !!i || 'Required']"
            />
          </v-list-item>
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
  props: { confidence: { required: false, type: Number, default: 0 } },
  data () {
    return {
      isActive: false,
      value: this.confidence
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
      this.$emit('submit', { confidence: this.value })
      this.isActive = false
    }
  }
}
</script>
