import express from "express";

import { singUp, login, singOut } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/sing-up", singUp);

router.post("/login", login);

router.post("/sing-out", singOut);

export default router;
