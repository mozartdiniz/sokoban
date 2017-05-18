// Package config
const config = require('./package').config
// User config
const argv = require('minimist')(process.argv.slice(2))
const host = (argv && argv.host) || ''
const port = (argv && argv.port) || config.port || 80
// Webpack
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const WebpackDevServer = require('webpack-dev-server')
// Proxy
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
const proxyPort = port + 1
// API
const fs = require('fs')
const path = require('path')
const levels = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'api', 'levels.json'))
)
const scores = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'api', 'scores.json'))
)
// WS
require('express-ws')(app)
// Constants
const INDENTATION = 2
// Helpers
const recurseAndReplaceImageValues = (object, imageKey, imageValue) => {
  if (object.constructor.name === 'Array') {
    object.forEach((entry, index) => {
      if (
        entry !== undefined &&
        entry !== null &&
        entry.constructor.name !== 'Array' &&
        entry.constructor.name !== 'Object' &&
        entry === imageKey
      ) {
        object[index] = imageValue
      } else if (
        entry !== undefined &&
        entry !== null &&
        (entry.constructor.name === 'Array' ||
          entry.constructor.name === 'Object')
      ) {
        recurseAndReplaceImageValues(object[index], imageKey, imageValue)
      }
    })
  } else if (object.constructor.name === 'Object') {
    Object.keys(object).forEach(key => {
      if (
        object[key] !== undefined &&
        object[key] !== null &&
        object[key].constructor.name !== 'Array' &&
        object[key].constructor.name !== 'Object' &&
        object[key] === imageKey
      ) {
        object[key] = imageValue
      } else if (
        object[key] !== undefined &&
        object[key] !== null &&
        (object[key].constructor.name === 'Array' ||
          object[key].constructor.name === 'Object')
      ) {
        recurseAndReplaceImageValues(object[key], imageKey, imageValue)
      }
    })
  }
}
const recurseAndFindImages = (object, regexp, destination) => {
  if (object.constructor.name === 'Array') {
    object.forEach((entry, index) => {
      if (
        entry !== undefined &&
        entry !== null &&
        entry.constructor.name !== 'Array' &&
        entry.constructor.name !== 'Object' &&
        regexp.test(entry)
      ) {
        destination[entry] = true
      } else if (
        entry !== undefined &&
        entry !== null &&
        (entry.constructor.name === 'Array' ||
          entry.constructor.name === 'Object')
      ) {
        recurseAndFindImages(object[index], regexp, destination)
      }
    })
  } else if (object.constructor.name === 'Object') {
    Object.keys(object).forEach(key => {
      if (
        object[key] !== undefined &&
        object[key] !== null &&
        object[key].constructor.name !== 'Array' &&
        object[key].constructor.name !== 'Object' &&
        regexp.test(object[key])
      ) {
        destination[object[key]] = true
      } else if (
        object[key] !== undefined &&
        object[key] !== null &&
        (object[key].constructor.name === 'Array' ||
          object[key].constructor.name === 'Object')
      ) {
        recurseAndFindImages(object[key], regexp, destination)
      }
    })
  }
}
// Recorder
const slug = require('slug')
const download = require('download')
const recordingsPath = path.resolve(__dirname, 'recordings')
let __IS_RECORDING__ = false
let recording = {}
const postProcessRecording = async name => {
  const recording = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, 'recordings', name, 'recording.json')
    )
  )
  const regexp = /^(http|\/).+(\.png|\.jpg)/
  recurseAndFindImages(recording.initialState, regexp, recording.images)
  recurseAndFindImages(recording.dispatches, regexp, recording.images)
  recurseAndFindImages(recording.xhrResponses, regexp, recording.images)
  recurseAndFindImages(recording.wsResponses, regexp, recording.images)
  recurseAndFindImages(recording.sseResponses, regexp, recording.images)
  let counter = 0
  const imagesArray = Object.keys(recording.images)
  for (let image of imagesArray) {
    const data = await download(image)
    if (/\.png/.test(image)) {
      recording.images[image] =
        'data:image/png;base64,' + data.toString('base64')
    } else if (/\.jpg/.test(image)) {
      recording.images[image] =
        'data:image/jpg;base64,' + data.toString('base64')
    }
    counter = counter + 1
    if (counter === imagesArray.length) {
      fs.writeFileSync(
        path.resolve(__dirname, 'recordings', name, 'recording.json'),
        JSON.stringify(recording, null, INDENTATION)
      )
      console.log('Added base64 images to recording!') // eslint-disable-line no-console
    }
  }
}
// Replayer
let __IS_REPLAYING__ = false
const preProcessRecording = recording => {
  const imagesArray = Object.keys(recording.images)
  imagesArray.forEach(image => {
    recurseAndReplaceImageValues(
      recording.initialState,
      image,
      recording.images[image]
    )
    recurseAndReplaceImageValues(
      recording.dispatches,
      image,
      recording.images[image]
    )
    recurseAndReplaceImageValues(
      recording.xhrResponses,
      image,
      recording.images[image]
    )
    recurseAndReplaceImageValues(
      recording.wsResponses,
      image,
      recording.images[image]
    )
    recurseAndReplaceImageValues(
      recording.sseResponses,
      image,
      recording.images[image]
    )
  })
}

app.get('/api/levels/:id', (request, response) => {
  setTimeout(() => {
    response.json(levels[request.params.id])
  }, 500)
})
app.get('/api/scores', (request, response) => {
  setTimeout(() => {
    response.json(scores)
  }, 500)
})
app.post('/api/scores', (request, response) => {
  setTimeout(() => {
    fs.writeFileSync(
      path.resolve(__dirname, 'api', 'scores.json'),
      JSON.stringify(request.body, null, INDENTATION)
    )
    response.json({ status: 'Scores saved.' })
  }, 500)
})

app.get('/graphql', (request, response) => {
  response.json({ status: 'OK' })
})
app.post('/graphql', (request, response) => {
  response.json({ status: 'OK' })
})

app.ws('/recorder', (ws, request) => {
  ws.on('message', message => {
    const payload = JSON.parse(message)
    if (payload.startRecording) {
      __IS_RECORDING__ = true
      console.log('Started recording!') // eslint-disable-line no-console
      recording.initialState = payload.initialState
      recording.dispatches = []
      recording.keyPresses = []
      recording.xhrResponses = []
      recording.wsResponses = []
      recording.sseResponses = []
      recording.images = {}
    } else if (payload.stopRecording) {
      __IS_RECORDING__ = false
      if (!fs.existsSync(recordingsPath)) {
        fs.mkdirSync(recordingsPath)
      }
      const name = slug(payload.name || Date.now())
      recording.impurities = payload.impurities
      const recordingFolderPath = path.resolve(__dirname, 'recordings', name)
      if (!fs.existsSync(recordingFolderPath)) {
        fs.mkdirSync(recordingFolderPath)
      }
      const recordingFilePath = path.resolve(
        __dirname,
        'recordings',
        name,
        'recording.json'
      )
      let updated = ''
      if (fs.existsSync(recordingFilePath)) {
        console.log('Updating ' + name + '!') // eslint-disable-line no-console
        const screenshots = fs
          .readdirSync(recordingFolderPath)
          .filter(file => /\.png$/.test(file))
        if (screenshots.length) {
          screenshots.forEach(screenshot =>
            fs.unlinkSync(path.resolve(recordingFolderPath, screenshot))
          )
          console.log('Removed old screenshots.') // eslint-disable-line no-console
        }
        updated = 'updated '
      }
      fs.writeFileSync(
        recordingFilePath,
        JSON.stringify(recording, null, INDENTATION)
      )
      recording = {}
      console.log('Stopped recording, saved ' + updated + name + '!') // eslint-disable-line no-console
      postProcessRecording(name)
    } else if (
      payload.type &&
      (!payload.payload || (payload.payload && !payload.payload.code))
    ) {
      recording.dispatches.push(payload)
    } else if (payload.type && payload.payload && payload.payload.code) {
      recording.keyPresses.push(payload)
    }
  })
})
app.ws('/replayer', (ws, request) => {
  let name = ''
  let replayedRecording = {}
  let session = []
  let rawSession = false
  ws.on('message', message => {
    const payload = JSON.parse(message)
    if (payload.startReplaying) {
      if (
        payload.name &&
        fs.existsSync(path.resolve(__dirname, 'recordings', payload.name))
      ) {
        console.log('Started replaying!') // eslint-disable-line no-console

        name = payload.name
        replayedRecording = JSON.parse(
          fs.readFileSync(
            path.resolve(__dirname, 'recordings', name, 'recording.json')
          )
        )

        preProcessRecording(replayedRecording)
        ws.send(
          JSON.stringify({
            initialState: replayedRecording.initialState,
            impurities: replayedRecording.impurities
          })
        )

        session = replayedRecording.dispatches
        rawSession = payload.rawSession
        if (rawSession) {
          __IS_REPLAYING__ = true
          session = replayedRecording.keyPresses
        }
        if (session && session.length) {
          let index = 0
          const remoteDispatcher = () => {
            setTimeout(() => {
              if (session[index]) {
                ws.send(JSON.stringify(session[index]))
                index = index + 1
                remoteDispatcher()
              } else {
                ws.send(JSON.stringify({ done: true }))
              }
            }, 1000)
          }
          remoteDispatcher()
        }
      }
    } else if (payload.stopReplaying) {
      name = ''
      replayedRecording = {}
      session = []
      rawSession = false
      __IS_REPLAYING__ = false
      console.log('Stopped replaying!') // eslint-disable-line no-console
    }
  })
})
app.listen(proxyPort)

// Fixes for HMR
webpackConfig.output.publicPath =
  'http://' + (host ? host : 'localhost') + ':' + port + '/'
webpackConfig.entry[0] = webpackConfig.entry[0].replace(
  'localhost',
  (host ? host : 'localhost') + ':' + port
)

new WebpackDevServer(webpack(webpackConfig), {
  publicPath: webpackConfig.output.publicPath,
  hot: true,
  historyApiFallback: true,
  stats: {
    colors: true
  },
  proxy: {
    '/api/*': {
      target: 'http://' + (host || 'localhost') + ':' + proxyPort,
      bypass: (request, response, proxyOptions) => {
        if (/api/.test(request.url)) {
          let recordedResponse = {}
          let replayedResponse = {}

          if (__IS_REPLAYING__) {
            replayedResponse = recording.xhrResponses.shift()
          }

          response.oldWriteHead = response.writeHead
          response.writeHead = (statusCode, statusMessage, headers) => {
            if (__IS_RECORDING__) {
              recordedResponse.headers = {
                statusCode,
                statusMessage,
                headers
              }
            } else if (__IS_REPLAYING__) {
              statusCode = replayedResponse.headers.statusCode
              statusMessage = replayedResponse.headers.statusMessage
              headers = replayedResponse.headers.headers
            }
            response.oldWriteHead(statusCode, statusMessage, headers)
          }

          response.oldWrite = response.write
          response.write = (data, encoding) => {
            if (__IS_RECORDING__) {
              recordedResponse.body = JSON.parse(data.toString(encoding))
            } else if (__IS_REPLAYING__) {
              const body = JSON.stringify(replayedResponse.body)
              data = Buffer.from(body, encoding)
            }
            response.oldWrite(data)
          }
          response.on('finish', () => {
            if (__IS_RECORDING__) {
              recordedResponse.getHeaders = response.getHeaders()
              recordedResponse.__META__ = {
                timestamp: Date.now()
              }
              recording.xhrResponses.push(recordedResponse)
            }
          })
        }
        return false
      }
    },
    '/graphql': {
      target: 'http://' + (host || 'localhost') + ':' + proxyPort
    },
    '/recorder': {
      target: 'http://' + (host || 'localhost') + ':' + proxyPort,
      ws: true
    },
    '/replayer': {
      target: 'http://' + (host || 'localhost') + ':' + proxyPort,
      ws: true
    }
  }
}).listen(port, host, error => {
  if (error) {
    console.log(error) // eslint-disable-line no-console
    return
  }

  console.log('Listening at http://' + (host || 'localhost') + ':' + port) // eslint-disable-line no-console
})
