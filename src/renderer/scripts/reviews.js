import { dbFactory } from '@/scripts/db'

const flagStore = dbFactory('flags.db')

export const flagForReview = (filePath, word, extras) => {
  console.log(`Flagged ${filePath} with word id ${word.Id}`)
  return flagStore.update({ filePath, wordId: word.Id }, { filePath, wordId: word.Id, word, extras }, { upsert: true })
}

export const getFlagedFiles = () => {
  return flagStore.find({})
    .then(res => {
      return res.reduce((res, flag) => {
        const old = res[flag.filePath] || { wordCount: 0, words: [] }
        old.wordCount++
        old.words.push(flag.word)
        console.log(old)

        res[flag.filePath] = old
        return res
      }, {})
    })
}
