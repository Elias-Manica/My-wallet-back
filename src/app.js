import express from "express";
import cors from "cors";

import { singUp, login, singOut } from "./controllers/auth.controller.js";
import {
  createTransition,
  getTransitions,
  getBalance,
  deleteTransition,
  updateTransition,
} from "./controllers/user.controller.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/sing-up", singUp);

app.post("/login", login);

app.post("/sing-out", singOut);

app.post("/transition", createTransition);

app.get("/transition", getTransitions);

app.get("/balance", getBalance);

app.delete("/transition", deleteTransition);

app.put("/transition", updateTransition);

app.listen(5000, () => console.log("Server listen on port 5000"));
