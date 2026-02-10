import { CatalogoService } from './catalogo.service.js';

export class CatalogoController {
    constructor() {
        this.service = new CatalogoService();
    }

    /** @param {import('express').Request} req @param {import('express').Response} res */
    getAll = async (req, res) => {
        try {
            const data = await this.service.findAll();
            res.json({ status: 'success', data });
        } catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    };

    /** @param {import('express').Request} req @param {import('express').Response} res */
    getById = async (req, res) => {
        try {
            const data = await this.service.findOne(parseInt(req.params.id));
            if (!data) return res.status(404).json({ message: 'Concepto no encontrado' });
            res.json({ status: 'success', data });
        } catch (error) {
            res.status(500).json({ status: 'error', message: 'Error en el servidor' });
        }
    };

    /** @param {import('express').Request} req @param {import('express').Response} res */
    create = async (req, res) => {
        try {
            const data = await this.service.create(req.body);
            res.status(201).json({ status: 'success', data });
        } catch (error) {
            res.status(400).json({ status: 'error', message: 'Error al crear el concepto' });
        }
    };

    /** @param {import('express').Request} req @param {import('express').Response} res */
    update = async (req, res) => {
        try {
            const data = await this.service.update(parseInt(req.params.id), req.body);
            res.json({ status: 'success', data });
        } catch (error) {
            res.status(400).json({ status: 'error', message: 'Error al actualizar' });
        }
    };

    /** @param {import('express').Request} req @param {import('express').Response} res */
    delete = async (req, res) => {
        try {
            await this.service.delete(parseInt(req.params.id));
            res.json({ status: 'success', message: 'Concepto desactivado correctamente' });
        } catch (error) {
            res.status(400).json({ status: 'error', message: 'No se pudo eliminar el concepto' });
        }
    };
}