export const authorize = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado',
      });
    }

    if (!rolesPermitidos.includes(req.user.rol_nombre)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para acceder a este recurso',
        requiredRoles: rolesPermitidos,
        yourRole: req.user.rol_nombre,
      });
    }

    next();
  };
};
