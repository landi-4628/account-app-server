/**
 * 获取分页参数
 * @param req
 * @returns {{currentPage: number | number, pageSize: number | number, offset: number}}
 */
function getPagination(req) {
  let { currentPage, pageSize } = req.query
  currentPage = Math.abs(Number(currentPage)) || 1
  pageSize = Math.abs(Number(pageSize)) || 10
  const offset = (currentPage - 1) * pageSize

  return { currentPage, pageSize, offset }
}

export default getPagination
