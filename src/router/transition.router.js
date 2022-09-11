import express from "express";

import hasToken from "../middlewares/transition.middlewares.js";

import {
  createTransition,
  getTransitions,
  deleteTransition,
  updateTransition,
  getBalance,
} from "../controllers/user.controller.js";

const router = express.Router();

router.use(hasToken);

router.post("/transition", createTransition);

router.get("/transition", getTransitions);

router.get("/balance", getBalance);

router.delete("/transition", deleteTransition);

router.put("/transition", updateTransition);

export default router;
