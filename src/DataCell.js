import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'

import {
  ENTER_KEY,
  ESCAPE_KEY,
  TAB_KEY,
  RIGHT_KEY,
  LEFT_KEY,
  UP_KEY,
  DOWN_KEY
} from './keys'

import Cell from './Cell'
import CellShape from './CellShape'
import DataEditor from './DataEditor'
import ValueViewer from './ValueViewer'
import { renderValue, renderData } from './renderHelpers'

function initialData({ cell, row, col, valueRenderer, dataRenderer }) {
  return renderData(cell, row, col, valueRenderer, dataRenderer)
}

function initialValue({ cell, row, col, valueRenderer }) {
  return renderValue(cell, row, col, valueRenderer)
}

function widthStyle(cell) {
  const width = typeof cell.width === 'number' ? cell.width + 'px' : cell.width
  return width ? { width } : null
}

export default class DataCell extends PureComponent {
  constructor(props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.handleCommit = this.handleCommit.bind(this)
    this.handleRevert = this.handleRevert.bind(this)

    this.handleKey = this.handleKey.bind(this)
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseOver = this.handleMouseOver.bind(this)
    this.handleContextMenu = this.handleContextMenu.bind(this)
    this.handleDoubleClick = this.handleDoubleClick.bind(this)

    this.state = {
      updated: false,
      reverting: false, // 是否是要撤销单元格更新
      value: '',
      committing: false // 是否是要提交单元格更新
    }
  }

  componentDidUpdate(prevProps) {
    if (initialValue(prevProps) !== initialValue(this.props)) { // 渲染值更新，设置update为true
      this.setState({ updated: true })
      this.timeout = setTimeout(() => this.setState({ updated: false }), 700)
    }
    if (this.props.editing === true && prevProps.editing === false) { // 此单元格从普通状态进入编辑状态
      const value = this.props.clearing ? '' : initialData(this.props) // 如果 clearing 属性为 true，则情况单元格内容，否则设置为初始值
      this.setState({ value, reverting: false })
    }

    if (
      prevProps.editing === true &&
      this.props.editing === false && // 从编辑状态变为非编辑状态，并且不在撤销和提交阶段，值不等于初始值，触发 onChange 事件
      !this.state.reverting &&
      !this.state.committing &&
      this.state.value !== initialData(this.props)
    ) {
      this.props.onChange(this.props.row, this.props.col, this.state.value)
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  handleChange(value) {
    this.setState({ value, committing: false })
  }

  handleCommit(value, e) {
    const { onChange, onNavigate } = this.props
    if (value !== initialData(this.props)) { // 值不等于初始值
      this.setState({ value, committing: true }) // 单元格置为新值
      onChange(this.props.row, this.props.col, value) // 触发 onChange 事件
    } else {
      this.handleRevert() // 否则执行撤销
    }
    if (e) {
      e.preventDefault()
      onNavigate(e, true)
    }
  }

  handleRevert() { // 撤销更改
    this.setState({ reverting: true })
    this.props.onRevert()
  }

  handleMouseDown(e) {
    const { row, col, onMouseDown, cell } = this.props
    if (!cell.disableEvents) { // disable单元格的事件
      onMouseDown(row, col, e)
    }
  }

  handleMouseOver(e) {
    const { row, col, onMouseOver, cell } = this.props
    if (!cell.disableEvents) {
      onMouseOver(row, col)
    }
  }

  handleDoubleClick(e) {
    const { row, col, onDoubleClick, cell } = this.props
    if (!cell.disableEvents) {
      onDoubleClick(row, col)
    }
  }

  handleContextMenu(e) {
    const { row, col, onContextMenu, cell } = this.props
    if (!cell.disableEvents) {
      onContextMenu(e, row, col)
    }
  }

  handleKey(e) {
    const keyCode = e.which || e.keyCode
    if (keyCode === ESCAPE_KEY) { // esc 退出编辑
      return this.handleRevert()
    }
    const {
      cell: { component },
      forceEdit
    } = this.props
    const eatKeys = forceEdit || !!component
    const commit =
      keyCode === ENTER_KEY ||
      keyCode === TAB_KEY ||
      (!eatKeys && [LEFT_KEY, RIGHT_KEY, UP_KEY, DOWN_KEY].includes(keyCode))

    if (commit) { // 如果是提交键，则处理提交
      this.handleCommit(this.state.value, e)
    }
  }

  renderComponent(editing, cell) {
    const { component, readOnly, forceComponent } = cell
    if ((editing && !readOnly) || forceComponent) { // 编辑状态并且非可读 或者 强制使用 component，则返回对应component
      return component
    }
  }

  renderEditor(editing, cell, row, col, dataEditor) {
    if (editing) { // 可编辑状态才返回可编辑单元格
      // 首选传入的 cell.dataEditor ，然后是传入函数的 dataEditor，最后是默认的 DataEditor
      const Editor = cell.dataEditor || dataEditor || DataEditor
      return (
        <Editor
          cell={cell}
          row={row}
          col={col}
          value={this.state.value}
          onChange={this.handleChange}
          onCommit={this.handleCommit}
          onRevert={this.handleRevert}
          onKeyDown={this.handleKey}
        />
      )
    }
  }

  renderViewer(cell, row, col, valueRenderer, valueViewer) {
    const Viewer = cell.valueViewer || valueViewer || ValueViewer
    const value = renderValue(cell, row, col, valueRenderer) // 计算最终要渲染的值
    return <Viewer cell={cell} row={row} col={col} value={value} /> // 返回渲染的单元格
  }

  render() {
    const {
      row,
      col,
      cell,
      cellRenderer: CellRenderer,
      valueRenderer,
      dataEditor,
      valueViewer,
      attributesRenderer,
      selected,
      editing,
      onKeyUp
    } = this.props
    const { updated } = this.state

    const content =
      this.renderComponent(editing, cell) || // 渲染自定义的单元格组件
      this.renderEditor(editing, cell, row, col, dataEditor) || // 渲染编辑状态的单元格
      this.renderViewer(cell, row, col, valueRenderer, valueViewer) // 渲染普通的单元格

    const className = [
      cell.className, // 自定义类名
      'cell',
      cell.overflow, // 是否overflow
      selected && 'selected', // 选中样式
      editing && 'editing', // 编辑状态样式
      cell.readOnly && 'read-only', // 只读状态样式
      updated && 'updated'
    ]
      .filter(a => a)
      .join(' ')

    return (
      <CellRenderer
        row={row}
        col={col}
        cell={cell}
        selected={selected}
        editing={editing}
        updated={updated}
        attributesRenderer={attributesRenderer}
        className={className}
        style={widthStyle(cell)}
        onMouseDown={this.handleMouseDown}
        onMouseOver={this.handleMouseOver}
        onDoubleClick={this.handleDoubleClick}
        onContextMenu={this.handleContextMenu}
        onKeyUp={onKeyUp}
      >
        {content}
      </CellRenderer>
    )
  }
}

DataCell.propTypes = {
  row: PropTypes.number.isRequired,
  col: PropTypes.number.isRequired,
  cell: PropTypes.shape(CellShape).isRequired,
  forceEdit: PropTypes.bool,
  selected: PropTypes.bool,
  editing: PropTypes.bool,
  clearing: PropTypes.bool,
  cellRenderer: PropTypes.func,
  valueRenderer: PropTypes.func.isRequired,
  dataRenderer: PropTypes.func,
  valueViewer: PropTypes.func,
  dataEditor: PropTypes.func,
  attributesRenderer: PropTypes.func,
  onNavigate: PropTypes.func.isRequired,
  onMouseDown: PropTypes.func.isRequired,
  onMouseOver: PropTypes.func.isRequired,
  onDoubleClick: PropTypes.func.isRequired,
  onContextMenu: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onRevert: PropTypes.func.isRequired
}

DataCell.defaultProps = {
  forceEdit: false,
  selected: false,
  editing: false,
  clearing: false,
  cellRenderer: Cell
}
