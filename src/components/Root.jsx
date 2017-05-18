import React from 'react'
import PropTypes from 'prop-types'
import { Router } from 'react-router'
import { ApolloProvider } from 'react-apollo'
import getRoutes from 'routes'

const Root = ({ store, client, history }) => (
  <ApolloProvider store={store} client={client}>
    <Router history={history}>
      {getRoutes()}
    </Router>
  </ApolloProvider>
)

Root.propTypes = {
  store: PropTypes.object.isRequired,
  client: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired
}

export default Root
