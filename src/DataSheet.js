import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import Sheet from './Sheet'
import Row from './Row'
import Cell from './Cell'
import DataCell from './DataCell'
import DataEditor from './DataEditor'
import ValueViewer from './ValueViewer'
import {
  TAB_KEY, ENTER_KEY, DELETE_KEY, ESCAPE_KEY, BACKSPACE_KEY,
  LEFT_KEY, UP_KEY, DOWN_KEY, RIGHT_KEY
} from './keys'

const isEmpty = (obj) => Object.keys(obj).length === 0 // obj 是否为空对象

const range = (start, end) => {
  const array = []
  const inc = (end - start > 0)
  for (let i = start; inc ? (i <= end) : (i >= end); inc ? i++ : i--) {
    inc ? array.push(i) : array.unshift(i)
  }
  return array
}

const defaultParsePaste = (str) => {
  return str.split(/\r\n|\n|\r/)
    .map((row) => row.split('\t'))
}

export default class DataSheet extends PureComponent {
  constructor(props) {
    super(props)
    this.onMouseDown = this.onMouseDown.bind(this)
    this.onMouseUp = this.onMouseUp.bind(this)
    this.onMouseOver = this.onMouseOver.bind(this)
    this.onDoubleClick = this.onDoubleClick.bind(this)
    this.onContextMenu = this.onContextMenu.bind(this)
    this.handleNavigate = this.handleNavigate.bind(this)
    this.handleKey = this.handleKey.bind(this).bind(this)
    this.handleCut = this.handleCut.bind(this)
    this.handleCopy = this.handleCopy.bind(this)
    this.handlePaste = this.handlePaste.bind(this)
    this.pageClick = this.pageClick.bind(this)
    this.onChange = this.onChange.bind(this)
    this.onRevert = this.onRevert.bind(this)
    this.isSelected = this.isSelected.bind(this)
    this.isEditing = this.isEditing.bind(this)
    this.isClearing = this.isClearing.bind(this)
    this.handleComponentKey = this.handleComponentKey.bind(this)

    this.handleKeyboardCellMovement = this.handleKeyboardCellMovement.bind(this)

    this.defaultState = {
      start: {},
      end: {},
      selecting: false, // 是否是在选择状态，可以通过移动鼠标选择一块区域所有单元格
      forceEdit: false,
      editing: {}, // 处于编辑状态的单元格
      clear: {} // 处于清空状态的单元格
    }
    this.state = this.defaultState

    this.removeAllListeners = this.removeAllListeners.bind(this)
  }

  removeAllListeners() {
    document.removeEventListener('mousedown', this.pageClick)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('cut', this.handleCut)
    document.removeEventListener('copy', this.handleCopy)
    document.removeEventListener('paste', this.handlePaste)
    document.removeEventListener('keydown', this.handlePaste)
  }

  componentDidMount() {
    // Add listener scoped to the DataSheet that catches otherwise unhandled
    // keyboard events when displaying components
    // 给整个表格增加 keydown 方法
    this.dgDom && this.dgDom.addEventListener('keydown', this.handleComponentKey)
  }

  componentWillUnmount() {
    this.dgDom && this.dgDom.removeEventListener('keydown', this.handleComponentKey)
    this.removeAllListeners()
  }

  isSelectionControlled() {
    return ('selected' in this.props)
  }

  getState() {
    let state = this.state
    if (this.isSelectionControlled()) { // 是否有 selected 属性
      let { start, end } = this.props.selected || {}
      start = start || this.defaultState.start
      end = end || this.defaultState.end
      state = { ...state, start, end }
    }
    return state
  }

  _setState(state) {
    if (this.isSelectionControlled() && (('start' in state) || ('end' in state))) {
      let { start, end, ...rest } = state
      let { selected, onSelect } = this.props
      selected = selected || {}
      if (!start) {
        start = 'start' in selected ? selected.start : this.defaultState.start
      }
      if (!end) {
        end = 'end' in selected ? selected.end : this.defaultState.end
      }
      onSelect && onSelect({ start, end })
      this.setState(rest)
    } else {
      this.setState(state)
    }
  }

  pageClick(e) {
    // 点击表格之外的区域
    // 状态置为默认状态，所有的选中、编辑状态清空
    // 解除所有事件监听
    const element = this.dgDom
    if (!element.contains(e.target)) {
      this.setState(this.defaultState)
      this.removeAllListeners()
    }
  }

  handleCut(e) {
    if (isEmpty(this.state.editing)) {
      e.preventDefault()
      this.handleCopy(e)
      const { start, end } = this.getState()
      this.clearSelectedCells(start, end)
    }
  }

  handleCopy(e) {
    if (isEmpty(this.state.editing)) { // 没有单元格处于编辑状态才处理此事件
      e.preventDefault()
      const { dataRenderer, valueRenderer, data } = this.props
      const { start, end } = this.getState()

      // 遍历单元格获取内容
      const text = range(start.i, end.i).map((i) =>
        range(start.j, end.j).map(j => {
          const cell = data[i][j]
          const value = dataRenderer ? dataRenderer(cell, i, j) : null
          if (value === '' || value === null || typeof (value) === 'undefined') {
            return valueRenderer(cell, i, j)
          }
          return value
        }).join('\t')
      ).join('\n')
      e.clipboardData.setData('text/plain', text)
    }
  }

  handlePaste(e) {
    if (isEmpty(this.state.editing)) {
      let { start, end } = this.getState()

      start = { i: Math.min(start.i, end.i), j: Math.min(start.j, end.j) }
      end = { i: Math.max(start.i, end.i), j: Math.max(start.j, end.j) }

      const parse = this.props.parsePaste || defaultParsePaste
      const changes = []
      let pasteData = []
      if (window.clipboardData && window.clipboardData.getData) { // IE
        pasteData = parse(window.clipboardData.getData('Text'))
      } else if (e.clipboardData && e.clipboardData.getData) {
        pasteData = parse(e.clipboardData.getData('text/plain'))
      }

      // in order of preference
      const { data, onCellsChanged, onPaste, onChange } = this.props
      if (onCellsChanged) {
        const additions = []
        pasteData.forEach((row, i) => {
          row.forEach((value, j) => {
            end = { i: start.i + i, j: start.j + j }
            const cell = data[end.i] && data[end.i][end.j]
            if (!cell) {
              additions.push({ row: end.i, col: end.j, value })
            } else if (!cell.readOnly) {
              changes.push({ cell, row: end.i, col: end.j, value })
            }
          })
        })
        if (additions.length) {
          onCellsChanged(changes, additions)
        } else {
          onCellsChanged(changes)
        }
      } else if (onPaste) {
        pasteData.forEach((row, i) => {
          const rowData = []
          row.forEach((pastedData, j) => {
            end = { i: start.i + i, j: start.j + j }
            const cell = data[end.i] && data[end.i][end.j]
            rowData.push({ cell: cell, data: pastedData })
          })
          changes.push(rowData)
        })
        onPaste(changes)
      } else if (onChange) {
        pasteData.forEach((row, i) => {
          row.forEach((value, j) => {
            end = { i: start.i + i, j: start.j + j }
            const cell = data[end.i] && data[end.i][end.j]
            if (cell && !cell.readOnly) {
              onChange(cell, end.i, end.j, value)
            }
          })
        })
      }
      this._setState({ end })
    }
  }

  handleKeyboardCellMovement(e, commit = false) {
    const { start, editing } = this.getState()
    const { data } = this.props
    const isEditing = editing && !isEmpty(editing)
    const currentCell = data[start.i] && data[start.i][start.j]

    if (isEditing && !commit) {
      return false
    }
    const hasComponent = currentCell && currentCell.component

    const keyCode = e.which || e.keyCode

    if (hasComponent && (isEditing)) { // 渲染的是组件或者处于某个单元格是编辑状态
      e.preventDefault()
      return
    }

    if (keyCode === TAB_KEY) { // 按TAB键
      this.handleNavigate(e, { i: 0, j: e.shiftKey ? -1 : 1 }, true)
    } else if (keyCode === RIGHT_KEY) { // 按右移键
      this.handleNavigate(e, { i: 0, j: 1 })
    } else if (keyCode === LEFT_KEY) { // 按左移键
      this.handleNavigate(e, { i: 0, j: -1 })
    } else if (keyCode === UP_KEY) { // 按上移键
      this.handleNavigate(e, { i: -1, j: 0 })
    } else if (keyCode === DOWN_KEY) { // 按下移键
      this.handleNavigate(e, { i: 1, j: 0 })
    } else if (commit && keyCode === ENTER_KEY) { // commit 下按 enter 键
      this.handleNavigate(e, { i: e.shiftKey ? -1 : 1, j: 0 })
    }
  }

  handleKey(e) {
    if (e.isPropagationStopped && e.isPropagationStopped()) {
      return
    }
    const keyCode = e.which || e.keyCode
    const { start, end, editing } = this.getState()
    const isEditing = editing && !isEmpty(editing)
    const noCellsSelected = !start || isEmpty(start)
    const ctrlKeyPressed = e.ctrlKey || e.metaKey // 是否是控制键
    const deleteKeysPressed = (keyCode === DELETE_KEY || keyCode === BACKSPACE_KEY) // 是否是删除键
    const enterKeyPressed = keyCode === ENTER_KEY // 是否是 enter 键
    const numbersPressed = (keyCode >= 48 && keyCode <= 57)
    const lettersPressed = (keyCode >= 65 && keyCode <= 90)
    const latin1Supplement = (keyCode >= 160 && keyCode <= 255)
    const numPadKeysPressed = (keyCode >= 96 && keyCode <= 105)
    const currentCell = !noCellsSelected && this.props.data[start.i][start.j] // keydown 事件对应的单元格
    const equationKeysPressed = [
      187, /* equal */
      189, /* substract */
      190, /* period */
      107, /* add */
      109, /* decimal point */
      110
    ].indexOf(keyCode) > -1

    if (noCellsSelected || ctrlKeyPressed) { // 没有单元格被选中，并且按的是控制键
      return true
    }

    if (!isEditing) {
      this.handleKeyboardCellMovement(e)
      if (deleteKeysPressed) {
        e.preventDefault()
        this.clearSelectedCells(start, end)
      } else if (currentCell && !currentCell.readOnly) {
        if (enterKeyPressed) {
          this._setState({ editing: start, clear: {}, forceEdit: true })
          e.preventDefault()
        } else if (numbersPressed ||
          numPadKeysPressed ||
          lettersPressed ||
          latin1Supplement ||
          equationKeysPressed) {
          // empty out cell if user starts typing without pressing enter
          this._setState({ editing: start, clear: start, forceEdit: false })
        }
      }
    }
  }

  getSelectedCells(data, start, end) {
    let selected = []
    range(start.i, end.i).map(row => {
      range(start.j, end.j).map(col => {
        if (data[row] && data[row][col]) {
          selected.push({ cell: data[row][col], row, col })
        }
      })
    })
    return selected
  }

  clearSelectedCells(start, end) {
    const { data, onCellsChanged, onChange } = this.props
    const cells = this.getSelectedCells(data, start, end)
      .filter(cell => !cell.cell.readOnly) // 排除只读单元格
      .map(cell => ({ ...cell, value: '' })) // 用空值覆盖
    if (onCellsChanged) {
      onCellsChanged(cells)
      this.onRevert()
    } else if (onChange) {
      // ugly solution brought to you by https://reactjs.org/docs/react-component.html#setstate
      // setState in a loop is unreliable
      setTimeout(() => {
        cells.forEach(({ cell, row, col, value }) => {
          onChange(cell, row, col, value)
        })
        this.onRevert()
      }, 0)
    }
  }

  handleNavigate(e, offsets, jumpRow) { // 移动焦点
    if (offsets && (offsets.i || offsets.j)) {
      const { start, end } = this.getState()
      const { data } = this.props
      const oldStartLocation = { i: start.i, j: start.j }
      const newEndLocation = { i: end.i + offsets.i, j: end.j + offsets.j }

      let newLocation = { i: start.i + offsets.i, j: start.j + offsets.j }

      const updateLocation = () => {
        if (data[newLocation.i] && typeof (data[newLocation.i][newLocation.j]) !== 'undefined') {
          this._setState({
            start: e.shiftKey && !jumpRow ? oldStartLocation : newLocation, // 按住shift可以多行一起移动选择
            end: e.shiftKey && !jumpRow ? newEndLocation : newLocation,
            editing: {}
          })
          e.preventDefault()
          return true
        }
        return false
      }
      if (!updateLocation() && jumpRow) {
        if (offsets.j < 0) {
          newLocation = { i: start.i - 1, j: data[0].length - 1 }
        } else {
          newLocation = { i: start.i + 1, j: 0 }
        }
        updateLocation()
      }
    }
  }

  handleComponentKey(e) {
    // handles keyboard events when editing components
    const keyCode = e.which || e.keyCode
    if (![ENTER_KEY, ESCAPE_KEY, TAB_KEY].includes(keyCode)) {
      return
    }
    const { editing } = this.state
    const { data } = this.props
    const isEditing = !isEmpty(editing)
    if (isEditing) {
      const currentCell = data[editing.i][editing.j]
      const offset = e.shiftKey ? -1 : 1
      if (currentCell && currentCell.component && !currentCell.forceComponent) {
        e.preventDefault()
        let func = this.onRevert // ESCAPE_KEY
        if (keyCode === ENTER_KEY) {
          func = () => this.handleNavigate(e, { i: offset, j: 0 })
        } else if (keyCode === TAB_KEY) {
          func = () => this.handleNavigate(e, { i: 0, j: offset }, true)
        }
        // setTimeout makes sure that component is done handling the event before we take over
        setTimeout(() => { func(); this.dgDom && this.dgDom.focus() }, 1)
      }
    }
  }

  onContextMenu(evt, i, j) {
    let cell = this.props.data[i][j]
    if (this.props.onContextMenu) {
      this.props.onContextMenu(evt, cell, i, j)
    }
  }

  onDoubleClick(i, j) {
    let cell = this.props.data[i][j]
    if (!cell.readOnly) { // 双击单元格，若不是只读状态，则此单元格变为编辑状态
      this._setState({ editing: { i: i, j: j }, forceEdit: true, clear: {} })
    }
  }

  onMouseDown(i, j, e) {
    // 点击的是否是正在编辑的单元格
    const isNowEditingSameCell = !isEmpty(this.state.editing) && this.state.editing.i === i && this.state.editing.j === j
    let editing = (isEmpty(this.state.editing) || this.state.editing.i !== i || this.state.editing.j !== j)
      ? {} : this.state.editing

    this._setState({
      selecting: !isNowEditingSameCell, // 如果点击的和正在编辑的不是一个单元格，则进入选择状态
      start: e.shiftKey ? this.state.start : { i, j }, // 按着shift选择，可以选择一片区域
      end: { i, j },
      editing: editing,
      forceEdit: !!isNowEditingSameCell
    })

    var ua = window.navigator.userAgent
    var isIE = /MSIE|Trident/.test(ua)
    // Listen for Ctrl + V in case of IE
    if (isIE) {
      document.addEventListener('keydown', (e) => {
        if ((e.keyCode === 86 || e.which === 86) && e.ctrlKey) {
          this.handlePaste(e)
        }
      })
    }

    // Keep listening to mouse if user releases the mouse (dragging outside)
    // 只有在 mouseDown 到时候才开始监听一些事件，确保这些事件是在鼠标按下去之后发生
    // 如 mouseUp，在鼠标放下开始监听，然后 mouseUp 执行之后里面解除 mouseUp 的事件监听
    document.addEventListener('mouseup', this.onMouseUp)
    // Listen for any outside mouse clicks
    document.addEventListener('mousedown', this.pageClick)

    // Cut, copy and paste event handlers
    document.addEventListener('cut', this.handleCut)
    document.addEventListener('copy', this.handleCopy)
    document.addEventListener('paste', this.handlePaste)
  }

  onMouseOver(i, j) { // 点击选中某个单元格，然后按鼠标移动，选择一片区域的单元格
    if (this.state.selecting && isEmpty(this.state.editing)) {
      this._setState({ end: { i, j } })
    }
  }

  onMouseUp() {
    this._setState({ selecting: false }) // 鼠标抬起，选择结束
    document.removeEventListener('mouseup', this.onMouseUp)
  }

  onChange(row, col, value) {
    const { onChange, onCellsChanged, data } = this.props
    if (onCellsChanged) {
      onCellsChanged([{ cell: data[row][col], row, col, value }])
    } else if (onChange) {
      onChange(data[row][col], row, col, value)
    }
    this.onRevert()
  }

  onRevert() {
    this._setState({ editing: {} }) // 将编辑状态置空
    this.dgDom && this.dgDom.focus()
  }

  componentDidUpdate(prevProps, prevState) {
    let { start, end } = this.state
    let prevEnd = prevState.end
    if (!isEmpty(end) && !(end.i === prevEnd.i && end.j === prevEnd.j) && !this.isSelectionControlled()) {
      this.props.onSelect && this.props.onSelect({ start, end })
    }
  }

  isSelected(i, j) { // 是否是选中状态，在selected属性中的才能选中
    const { start, end } = this.getState()
    const posX = (j >= start.j && j <= end.j)
    const negX = (j <= start.j && j >= end.j)
    const posY = (i >= start.i && i <= end.i)
    const negY = (i <= start.i && i >= end.i)

    return (posX && posY) ||
      (negX && posY) ||
      (negX && negY) ||
      (posX && negY)
  }

  isEditing(i, j) { // 单元格是否处于编辑状态
    return this.state.editing.i === i && this.state.editing.j === j
  }

  isClearing(i, j) {
    return this.state.clear.i === i && this.state.clear.j === j
  }

  render() {
    const { sheetRenderer: SheetRenderer, rowRenderer: RowRenderer, cellRenderer,
      dataRenderer, valueRenderer, dataEditor, valueViewer, attributesRenderer,
      className, overflow, data, keyFn } = this.props
    const { forceEdit } = this.state

    return (
      <span ref={r => { this.dgDom = r }} tabIndex='0' className='data-grid-container' onKeyDown={this.handleKey}>
        <SheetRenderer data={data} className={['data-grid', className, overflow].filter(a => a).join(' ')}>
          {data.map((row, i) =>
            <RowRenderer key={keyFn ? keyFn(i) : i} row={i} cells={row}>
              {
                row.map((cell, j) => {
                  return (
                    <DataCell
                      key={cell.key ? cell.key : `${i}-${j}`}
                      row={i}
                      col={j}
                      cell={cell}
                      forceEdit={forceEdit}
                      onMouseDown={this.onMouseDown}
                      onMouseOver={this.onMouseOver}
                      onDoubleClick={this.onDoubleClick}
                      onContextMenu={this.onContextMenu}
                      onChange={this.onChange}
                      onRevert={this.onRevert}
                      onNavigate={this.handleKeyboardCellMovement}
                      onKey={this.handleKey}
                      selected={this.isSelected(i, j)} // 计算是否是选中状态
                      editing={this.isEditing(i, j)} // 是否是正在编辑的单元格
                      clearing={this.isClearing(i, j)}
                      attributesRenderer={attributesRenderer} // 自定义计算属性的方法
                      cellRenderer={cellRenderer} // 自定义的单元格渲染组件
                      valueRenderer={valueRenderer} // 自定义计算单元格值的方法
                      dataRenderer={dataRenderer}
                      valueViewer={valueViewer} // 自定义值渲染组件
                      dataEditor={dataEditor} // 自定义的单元格编辑器组件
                    />
                  )
                })
              }
            </RowRenderer>)
          }
        </SheetRenderer>
      </span>
    )
  }
}

DataSheet.propTypes = {
  data: PropTypes.array.isRequired,
  className: PropTypes.string,
  overflow: PropTypes.oneOf(['wrap', 'nowrap', 'clip']),
  onChange: PropTypes.func,
  onCellsChanged: PropTypes.func,
  onContextMenu: PropTypes.func,
  onSelect: PropTypes.func,
  selected: PropTypes.shape({
    start: PropTypes.shape({
      i: PropTypes.number,
      j: PropTypes.number
    }),
    end: PropTypes.shape({
      i: PropTypes.number,
      j: PropTypes.number
    })
  }),
  valueRenderer: PropTypes.func.isRequired,
  dataRenderer: PropTypes.func,
  sheetRenderer: PropTypes.func.isRequired,
  rowRenderer: PropTypes.func.isRequired,
  cellRenderer: PropTypes.func.isRequired,
  valueViewer: PropTypes.func,
  dataEditor: PropTypes.func,
  parsePaste: PropTypes.func,
  attributesRenderer: PropTypes.func,
  keyFn: PropTypes.func
}

DataSheet.defaultProps = {
  sheetRenderer: Sheet,
  rowRenderer: Row,
  cellRenderer: Cell,
  valueViewer: ValueViewer,
  dataEditor: DataEditor
}
