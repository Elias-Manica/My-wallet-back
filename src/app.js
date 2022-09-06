import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/sing-up", async (req, res) => {});

app.post("/sing-in", async (req, res) => {});

app.listen(5000, () => console.log("Server listen on port 5000"));
