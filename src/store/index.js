import _ from 'lodash'
import Immutable from 'immutable'
import { createStore, applyMiddleware } from 'redux'
import { ApolloClient } from 'react-apollo'
import createSagaMiddleware from 'redux-saga'
import appSaga from 'sagas'
import history from 'routes/history'
import {
  reducer as interactionReducer,
  middleware as interactionMiddleware,
  ActionCreators as InteractionActionCreators,
  Helpers as InteractionHelpers
} from 'domains/interaction'
import { reducer as timeReducer } from 'domains/time'
import {
  reducer as navigationReducer,
  middleware as createNavigationMiddleware,
  LOCATION_CHANGE
} from 'domains/navigation'
import { reducer as levelReducer } from 'domains/level'
import { reducer as scoresReducer } from 'domains/scores'
import {
  reducer as recorderReducer,
  middleware as recorderMiddleware,
  ActionCreators as RecorderActionCreators
} from 'domains/recorder'
import {
  reducer as replayerReducer,
  middleware as replayerMiddleware,
  ActionCreators as ReplayerActionCreators
} from 'domains/replayer'

export const client = new ApolloClient({
  reduxRootSelector: state => state.get('apollo')
})

const reducers = {
  interaction: interactionReducer,
  time: timeReducer,
  navigation: navigationReducer,
  level: levelReducer,
  scores: scoresReducer,
  recorder: recorderReducer,
  replayer: replayerReducer,
  apollo: client.reducer()
}

const appReducer = (state = Immutable.Map(), action = {}) => {
  switch (action.type) {
    case ReplayerActionCreators.setInitialState().type:
      return Immutable.fromJS(action.payload)
    default:
      const newState = _.reduce(
        reducers,
        (currentState, reducer, key) => {
          return currentState.update(key, stateSubtree =>
            reducer(stateSubtree, action)
          )
        },
        state
      )
      return newState
  }
}

const navigationMiddleware = createNavigationMiddleware(history)
const sagaMiddleware = createSagaMiddleware()
const savedState =
  Immutable.fromJS(JSON.parse(global.localStorage.getItem('state'))) ||
  Immutable.Map()

const pauseResumeInteractionMiddleware = middleware => {
  let paused = false
  let rawSession = false
  return store => next => {
    let delegate = middleware(store)(next)

    return action => {
      if (action.type === ReplayerActionCreators.startReplaying().type) {
        if (action.payload.rawSession) {
          rawSession = true
        } else {
          paused = true
        }
      } else if (action.type === ReplayerActionCreators.stopReplaying().type) {
        paused = false
        rawSession = false
      }
      return delegate(action, paused, action.__REPLAY__, rawSession)
    }
  }
}

let task = null

const pauseResumeSagaMiddleware = middleware => {
  let paused = false
  let running = true
  return store => next => {
    let delegate = middleware(store)(next)

    return action => {
      if (action.type === ReplayerActionCreators.startReplaying().type) {
        if (!action.payload.rawSession) {
          paused = true
        }
      } else if (action.type === ReplayerActionCreators.stopReplaying().type) {
        paused = false
      }

      if (paused) {
        if (task && task.isRunning()) {
          running = false
          task.cancel()
        }
        return next(action) // skip if paused
      } else {
        if (task && task.isCancelled() && !running) {
          running = true
          task = sagaMiddleware.run(appSaga)
        }
        return delegate(action)
      }
    }
  }
}

const filterRecorderMiddleware = middleware => {
  return store => next => {
    let delegate = middleware(store)(next)

    return action => {
      if (action.type === InteractionActionCreators.bindKeys().type) {
        action.payload = InteractionHelpers.convertPayloadValuesToBooleans(
          action.payload
        )
      } else if (action.type === LOCATION_CHANGE) {
        action.payload.key = ''
      } else if (action.type === InteractionActionCreators.keyPress().type) {
        action.payload = { code: action.payload.code }
      } else if (action.type === ReplayerActionCreators.stopReplaying().type) {
        store.dispatch(RecorderActionCreators.stopRecording())
      }
      return delegate(action)
    }
  }
}

const appMiddleware = applyMiddleware(
  pauseResumeInteractionMiddleware(interactionMiddleware),
  navigationMiddleware,
  pauseResumeSagaMiddleware(sagaMiddleware),
  filterRecorderMiddleware(recorderMiddleware),
  replayerMiddleware,
  client.middleware()
)

const store = createStore(appReducer, savedState, appMiddleware)

task = sagaMiddleware.run(appSaga)

global.onbeforeunload = () => {
  const stateToSave = store.getState().toJS()
  _.forEach(
    _.keys(stateToSave),
    key => (key !== 'level' ? (stateToSave[key] = undefined) : null)
  )
  global.localStorage.setItem('state', JSON.stringify(stateToSave))
}

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  global.__STORE__ = store
}

export default store
