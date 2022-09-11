import express from "express";
import cors from "cors";

import authRouter from "./router/auth.router.js";
import userRouter from "./router/transition.router.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use(authRouter);

app.use(userRouter);

app.listen(5000, () => console.log("Server listen on port 5000"));
