import styles from './styles'

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { graphql, gql, compose } from 'react-apollo'
import classNames from 'classnames'
import {
  ActionCreators as InteractionActionCreators
} from 'domains/interaction'
import {
  ActionCreators as NavigationActionCreators,
  Selectors as NavigationSelectors
} from 'domains/navigation'
import { Selectors as ScoresSelectors } from 'domains/scores'
import { Container, Message, Button } from 'components/presentational'

const mapStateToProps = state => ({
  backgroundImage: ScoresSelectors.backgroundImage(state),
  selectedItemIndex: NavigationSelectors.currentViewState(state).get(
    'selectedItemIndex'
  ) > -1
    ? NavigationSelectors.currentViewState(state).get('selectedItemIndex')
    : -1
})
const mapDispatchToProps = {
  bindKeys: InteractionActionCreators.bindKeys,
  unbindKeys: InteractionActionCreators.unbindKeys,
  updateViewState: NavigationActionCreators.updateViewState,
  back: NavigationActionCreators.navigateBack
}

class HighScores extends Component {
  constructor(props) {
    super(props)
    this.keyMap = {
      ArrowUp: () => {
        const { selectedItemIndex, updateViewState } = this.props

        if (selectedItemIndex > -1) {
          updateViewState({ selectedItemIndex: selectedItemIndex - 1 })
        }
      },
      ArrowDown: () => {
        const {
          data: { scores },
          selectedItemIndex,
          updateViewState
        } = this.props

        if (!scores) {
          return
        }

        if (scores[selectedItemIndex + 1]) {
          updateViewState({ selectedItemIndex: selectedItemIndex + 1 })
        }
      },
      ArrowLeft: () => {
        const { selectedItemIndex, updateViewState } = this.props

        if (selectedItemIndex - 10 > -1) {
          updateViewState({ selectedItemIndex: selectedItemIndex - 10 })
        }
      },
      ArrowRight: () => {
        const {
          data: { scores },
          selectedItemIndex,
          updateViewState
        } = this.props

        if (!scores) {
          return
        }

        if (scores[selectedItemIndex + 10]) {
          updateViewState({ selectedItemIndex: selectedItemIndex + 10 })
        }
      },
      Space: () => {
        const {
          data: { scores },
          selectedItemIndex,
          removeScore,
          removeAllScores
        } = this.props

        if (!scores) {
          return
        }

        if (selectedItemIndex === -1) {
          removeAllScores({
            variables: {
              scoresToSet: {
                scores: scores.map(score => ({
                  id: score.id,
                  playerMoves: -1,
                  boxMoves: -1
                }))
              }
            }
          })
        } else if (
          selectedItemIndex > -1 &&
          selectedItemIndex < scores.length
        ) {
          removeScore({
            variables: {
              scoreToSet: {
                id: `${selectedItemIndex + 1}`,
                playerMoves: -1,
                boxMoves: -1
              }
            }
          })
        }
      },
      KeyB: () => {
        this.props.back()
      }
    }
  }

  componentWillMount() {
    this.props.bindKeys(this.keyMap)
  }

  componentWillUnmount() {
    this.props.unbindKeys(this.keyMap)
    this.keyMap = null
  }

  render() {
    const { data: { scores }, backgroundImage, selectedItemIndex } = this.props
    const explanation = 'Level: player moves / box moves'
    const removeAllLevels = 'Remove all levels'
    const removeLevel = 'Remove level'
    const lists = []
    let children = []
    scores &&
      scores.length &&
      scores.forEach((score, index) => {
        children.push(
          <Message
            key={`m${index}`}
            className={classNames(
              styles.message,
              (score.playerMoves || score.boxMoves) && styles.success
            )}
          >{`${score.id}: ${score.playerMoves || '-'} / ${score.boxMoves || '-'}`}</Message>
        )
        children.push(
          <Button key={`b${index}`} selected={selectedItemIndex === index}>
            {removeLevel}
          </Button>
        )
        if ((index + 1) % 10 === 0) {
          lists.push(
            <Container key={index} className={styles.list}>
              {children}
            </Container>
          )
          children = []
        } else if (index + 1 === scores.length && scores.length < 10) {
          lists.push(
            <Container key={index} className={styles.list}>
              {children}
            </Container>
          )
        }
      })

    return (
      <Container>
        <img
          src={backgroundImage}
          width={600}
          height={400}
          className={styles.backgroundImage}
        />
        <Message>{explanation}</Message>
        <Button selected={selectedItemIndex === -1}>{removeAllLevels}</Button>
        {lists}
      </Container>
    )
  }
}

const allScoresQuery = gql`
  query {
    scores {
      id
      playerMoves
      boxMoves
    }
  }
`

const removeScoreMutation = gql`
  mutation ($scoreToSet: ScoreInput!) {
    setScore(input: $scoreToSet) {
      id
      playerMoves
      boxMoves
    }
  }
`

const removeAllScoresMutation = gql`
  mutation ($scoresToSet: ScoresInput!) {
    setScores(input: $scoresToSet) {
      id
      playerMoves
      boxMoves
    }
  }
`

const HighScoresWithQuery = compose(
  graphql(allScoresQuery),
  graphql(removeScoreMutation, { name: 'removeScore' }),
  graphql(removeAllScoresMutation, { name: 'removeAllScores' })
)(HighScores)

HighScores.propTypes = {
  data: PropTypes.object,
  backgroundImage: PropTypes.string,
  selectedItemIndex: PropTypes.number,
  bindKeys: PropTypes.func.isRequired,
  unbindKeys: PropTypes.func.isRequired,
  updateViewState: PropTypes.func.isRequired,
  removeAllScores: PropTypes.func.isRequired,
  removeScore: PropTypes.func.isRequired,
  back: PropTypes.func.isRequired
}

export default connect(mapStateToProps, mapDispatchToProps)(HighScoresWithQuery)
