<template>
  <v-app>
    <v-card flat align="center">
      <v-toolbar
        color="primary"
        dark
        extended
        flat
      >
        Document Converter
      </v-toolbar>

      <v-card
        align="left"
        class="mx-auto"
        max-width="800"
        style="margin-top: -64px;"
      >
        <nuxt />
      </v-card>
    </v-card>
  </v-app>
</template>

<script>
export default {
  data () {
    return {
      title: ''
    }
  }
}
</script>

<style>
body {
  margin: 0 !important;
}
</style>
