import createError from 'http-errors'

/**
 * 将常见错误类型映射为简短中文说明（用于 JSON 的 message 字段）
 * @param {Error} err
 */
function summarizeError(err) {
  if (err instanceof createError.HttpError) {
    const map = {
      BadRequestError: '请求参数无效',
      UnauthorizedError: '身份验证失败',
      ForbiddenError: '无访问权限',
      NotFoundError: '资源不存在',
      ConflictError: '与现有数据冲突',
      PayloadTooLargeError: '请求体过大',
      TooManyRequestsError: '请求过于频繁',
    }
    return map[err.name] ?? '请求无法完成'
  }

  if (err.name === 'SequelizeValidationError') {
    return '数据验证未通过'
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return '违反唯一约束'
  }

  if (err.name === 'SequelizeDatabaseError') {
    return '数据库执行出错'
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return '外键约束冲突'
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return '令牌无效或已过期'
  }

  return '服务器内部错误'
}

/**
 * 请求成功
 * @param res
 * @param message
 * @param data
 * @param code
 */
function success(res, message, data = {}, code = 200) {
  res.status(code).json({
    status: true,
    message,
    data,
  })
}

/**
 * 请求失败
 * @param res
 * @param err
 */
function failure(res, err) {
  let statusCode = 500
  let errors = '服务器发生错误，请稍后重试。'

  if (process.env.NODE_ENV === 'development') {
    console.log(err)
    errors = err.message
  }

  if (err.name === 'SequelizeValidationError') {
    statusCode = 400
    errors = err.errors.map((e) => e.message)
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401
    errors = '您提交的令牌无效或已过期。'
  } else if (err instanceof createError.HttpError) {
    statusCode = err.status
    errors = err.message
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409
    errors = err.message || '数据与唯一约束冲突。'
  } else if (err.name === 'SequelizeDatabaseError' || err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400
    errors = process.env.NODE_ENV === 'development' ? err.message : '数据库操作失败，请检查数据是否合法。'
  }

  res.status(statusCode).json({
    status: false,
    message: summarizeError(err),
    errors: Array.isArray(errors) ? errors : [errors],
  })
}

export { success, failure }
