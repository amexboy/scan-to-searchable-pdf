<template>
  <v-card-text>
    <v-list-item>
      Configure
    </v-list-item>
    <v-divider />

    <v-list>
      <v-list-item-group
        color="primary"
      >
        <v-list-item>
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field v-model="bucketName" :rules="[ i => !!i || 'You must set Bucket name']"
                            hint="Files will be uploaded to S3 to be processed!"
                            label="Bucket name"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="region" :rules="[ i => !!i || 'You must choose a region']"
                            hint="Choose an AWS region for calling AWS services"
                            label="AWS Region"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="apiKeyId" hint="Will be used to authenticate with AWS"
                            label="AWS API Key Id"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="apiKeySecret" hint="Will be used to authenticate with AWS"
                            label="AWS API Key Secret"
              />
            </v-col>
          </v-row>
        </v-list-item>
      </v-list-item-group>
      <v-list-item>
        <v-spacer />
        <v-btn text :loading="processing" @click="save"><v-icon>mdi-save</v-icon> Save</v-btn>
      </v-list-item>
    </v-list>
  </v-card-text>
</template>

<script>
import { getBucketName, setBucketName, setAwsAccess, getCredential } from '@/scripts/aws'

export default {
  data () {
    return {
      processing: false,
      bucketName: '',
      region: '',
      apiKeyId: '',
      apiKeySecret: '',
      allowedTypes: ['.png', '.jpg', '.jpeg', '.pdf']
    }
  },
  mounted () {
    getBucketName()
      .then(name => {
        console.log(name)
        this.bucketName = name
      })

    getCredential().then(config => {
      console.log(config)
      this.apiKeyId = config.credentials ? config.credentials.accessKeyId : ''
      this.apiKeySecret = config.credentials ? config.credentials.secretAccessKey : ''
      this.region = config.region
    })
  },
  methods: {
    save () {
      this.processing = true
      Promise.all([
        setBucketName(this.bucketName),
        setAwsAccess(this.apiKeyId, this.apiKeySecret, this.region)
      ])
        .then(_ => {
          this.processing = false
        })
    }
  }
}
</script>