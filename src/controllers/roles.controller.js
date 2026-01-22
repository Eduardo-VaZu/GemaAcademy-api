import { rolesService } from '../services/roles.service.js';

export const rolesController = {
  /**
   * GET /api/roles
   * Obtener todos los roles
   */
  getAllRoles: async (req, res) => {
    try {
      const roles = await rolesService.getAllRoles();
      
      res.json({
        status: 'success',
        data: roles
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener roles',
        detail: error.message
      });
    }
  },

  /**
   * GET /api/roles/:id
   * Obtener un rol por ID
   */
  getRoleById: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await rolesService.getRoleById(id);

      if (!role) {
        return res.status(404).json({
          status: 'error',
          message: 'Rol no encontrado'
        });
      }

      res.json({
        status: 'success',
        data: role
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener rol',
        detail: error.message
      });
    }
  },

  /**
   * POST /api/roles
   * Crear un nuevo rol
   */
  createRole: async (req, res) => {
    try {
      const role = await rolesService.createRole(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Rol creado exitosamente',
        data: role
      });
    } catch (error) {
      if (error.message.includes('ya existe')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }

      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'El nombre del rol ya existe'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al crear rol',
        detail: error.message
      });
    }
  },

  /**
   * PUT /api/roles/:id
   * Actualizar un rol
   */
  updateRole: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await rolesService.updateRole(id, req.body);

      res.json({
        status: 'success',
        message: 'Rol actualizado exitosamente',
        data: role
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          status: 'error',
          message: 'Rol no encontrado'
        });
      }

      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'El nombre del rol ya existe'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al actualizar rol',
        detail: error.message
      });
    }
  },

  /**
   * DELETE /api/roles/:id
   * Eliminar un rol
   */
  deleteRole: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await rolesService.deleteRole(id);

      res.json({
        status: 'success',
        message: 'Rol eliminado exitosamente'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          status: 'error',
          message: 'Rol no encontrado'
        });
      }

      if (error.code === 'P2003') {
        return res.status(400).json({
          status: 'error',
          message: 'No se puede eliminar el rol porque tiene usuarios asociados'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al eliminar rol',
        detail: error.message
      });
    }
  }
};
