
export function renderValue(cell, row, col, valueRenderer) {
  const value = valueRenderer(cell, row, col) // 自定义 valueRenderer 可以根据 row 和 col 计算最终要渲染的值
  return (value === null || typeof (value) === 'undefined') ? '' : value // 如果没有值，直接返回空字符串
}

export function renderData(cell, row, col, valueRenderer, dataRenderer) {
  const value = dataRenderer ? dataRenderer(cell, row, col) : null
  return (value === null || typeof (value) === 'undefined') ? renderValue(cell, row, col, valueRenderer) : value
}
