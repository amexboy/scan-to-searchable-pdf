const colors = require('vuetify/es5/util/colors').default
/**
 * By default, Nuxt.js is configured to cover most use cases.
 * This default configuration can be overwritten in this file
 * @link {https://nuxtjs.org/guide/configuration/}
 */

module.exports = {
  ssr: false, // or 'universal'
  head: {
    titleTemplate: 'PDF to Searchable Converter',
    title: process.env.npm_package_name || '',
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || ''
      }
    ],
    link: [
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico'
      }
    ]
  },
  loading: false,
  plugins: [
    { ssr: true, src: '@/plugins/icons.js' },
    '@/plugins/listener.js'
  ],
  modules: [
    '@nuxtjs/vuetify',
    ['@nuxtjs/dotenv', { filename: `.env.${process.env.NODE_ENV}` }],
    ['vuetify-dialog/nuxt', { property: '$dialog' }]
  ],
  vuetify: {
    icons: {
      iconfont: 'fa4'
    },
    theme: {
      dark: false,
      themes: {
        dark: {
          primary: colors.blue.darken2,
          accent: colors.grey.darken3,
          secondary: colors.amber.darken3,
          info: colors.teal.lighten1,
          warning: colors.amber.base,
          error: colors.deepOrange.accent4,
          success: colors.green.accent3
        }
      }
    }
  }
}
