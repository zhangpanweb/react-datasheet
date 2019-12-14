import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import CellShape from './CellShape'

export default class Cell extends PureComponent {
  render() {
    const {
      cell, row, col, attributesRenderer,
      className, style, onMouseDown, onMouseOver, onDoubleClick, onContextMenu
    } = this.props

    const { colSpan, rowSpan } = cell
    // 通过 attributesRenderer 传入 cell、row、col 计算单元格属性
    const attributes = attributesRenderer ? attributesRenderer(cell, row, col) : {}

    return (
      <td
        className={className}
        onMouseDown={onMouseDown}
        onMouseOver={onMouseOver}
        onDoubleClick={onDoubleClick}
        onTouchEnd={onDoubleClick}
        onContextMenu={onContextMenu}
        colSpan={colSpan}
        rowSpan={rowSpan}
        style={style}
        {...attributes}
      >
        {this.props.children}
      </td>
    )
  }
}

Cell.propTypes = { // 所有的传入属性都可被自定义的 cellRenderer 使用
  row: PropTypes.number.isRequired,
  col: PropTypes.number.isRequired,
  cell: PropTypes.shape(CellShape).isRequired,
  selected: PropTypes.bool,
  editing: PropTypes.bool,
  updated: PropTypes.bool,
  attributesRenderer: PropTypes.func,
  onMouseDown: PropTypes.func.isRequired,
  onMouseOver: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
  onContextMenu: PropTypes.func.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
}

Cell.defaultProps = {
  selected: false,
  editing: false,
  updated: false,
  attributesRenderer: () => { }
}
