/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga uno de los roles permitidos
 * @param {Array<string>} rolesPermitidos - Array de nombres de roles permitidos (ej: ['Administrador', 'Profesor'])
 */
export const authorize = (...rolesPermitidos) => {
  return (req, res, next) => {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado'
      });
    }

    // Verificar que el usuario tenga el rol permitido
    if (!rolesPermitidos.includes(req.user.rol_nombre)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para acceder a este recurso',
        requiredRoles: rolesPermitidos,
        yourRole: req.user.rol_nombre
      });
    }

    next();
  };
};
