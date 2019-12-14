import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'

import CellShape from './CellShape'

export default class ValueViewer extends PureComponent { // 渲染最为普通的单元格
  render() {
    const { value } = this.props
    return (
      <span className='value-viewer'>
        {value}
      </span>
    )
  }
}

ValueViewer.propTypes = {
  row: PropTypes.number.isRequired,
  col: PropTypes.number.isRequired,
  cell: PropTypes.shape(CellShape),
  value: PropTypes.node.isRequired
}
