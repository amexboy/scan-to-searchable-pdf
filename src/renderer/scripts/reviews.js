import { dbFactory } from '@/scripts/db'
import { processFile } from '@/scripts/process_file'

const flagStore = dbFactory('flags.db')
const updateStore = dbFactory('updates.db')

export const flagForReview = (filePath, word, extras) => {
  console.log(`Flagged ${filePath} with word id ${word.Id}`, word, extras)
  return flagStore.update({ filePath, wordId: word.Id }, { filePath, wordId: word.Id, word, extras }, { upsert: true })
}

export const getFlagedFiles = () => {
  return flagStore.find({})
    .then(res => {
      return res.reduce((res, flag) => {
        const old = res[flag.filePath] || { wordCount: 0, words: [], extras: flag.extras }
        old.wordCount++
        old.words.push({ ...flag.word, path: flag.filePath })

        res[flag.filePath] = old
        return res
      }, {})
    })
}

export const approveWord = (filePath, wordId, newWord) => {
  return flagStore.find({ filePath, wordId })
    .then(res => {
      const word = res[0]
      console.log('Removing flagged word', word, newWord)
      return updateStore
        .update({ filePath, wordId }, { filePath, wordId, correction: newWord || word.word.Text }, { upsert: true })
        .then(_ => word)
    })
    .then(word => {
      flagStore.remove({ filePath, wordId })
      return word
    })
    .then(word => {
      return flagStore.find({ filePath })
        .then(res => {
          console.log(res)
          if (res.length === 0) {
            console.log('Regenerating file')
            const fileToProcess = word.extras.originalPath || filePath
            return processFile(fileToProcess, word.extras.type, word.extras.output, true)
          }
        })
    })
}

export const wordUpdate = (filePath, wordId) => {
  return updateStore.find({ filePath, wordId })
    .then(([word]) => {
      return word ? word.correction : undefined
    })
}
