import express from "express";

import {
  createTransition,
  getTransitions,
  deleteTransition,
  updateTransition,
  getBalance,
} from "../controllers/user.controller.js";

const router = express.Router();

router.post("/transition", createTransition);

router.get("/transition", getTransitions);

router.get("/balance", getBalance);

router.delete("/transition", deleteTransition);

router.put("/transition", updateTransition);

export default router;
