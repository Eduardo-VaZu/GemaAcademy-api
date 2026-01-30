export class apiResponse {
  static success(res, { data, message = 'Operacion Exitosa', meta } = {}) {
    return res.status(200).json({
      success: true,
      message,
      data,
      ...(meta && { meta }),
    });
  }

  static created(res, { data, message = 'Recurso creado exitosamente' } = {}) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static error(res, { status = 500, message = 'Error interno del servidor', details } = {}) {
    return res.status(status).json({
      success: 'error',
      message,
      ...(details && { details }),
    });
  }
}
