import { nivelService } from './niveles.service.js';

export const nivelController = {
  getAllNiveles: async (req, res, next) => {
    try {
      const niveles = await nivelService.getAllNiveles();
      res.status(200).json(niveles);
    } catch (error) {
      next(error);
    }
  },
};
