import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("wallet");
});

const entraceSchema = joi.object({
  value: joi.number().required().positive(),
  description: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/),
});

//Entrada
app.post("/deposity", async (req, res) => {
  //usar o token
  //trocar user pelo token ou email
  const User = req.headers;
  const userWithOutSpecLett = decodeURIComponent(escape(User.user));

  console.log(
    userWithOutSpecLett.length <= 0 || userWithOutSpecLett === undefined
  );

  if (!User.user) {
    res.status(422).send({ error: "Usuário necessário" });
    return;
  }

  const validation = entraceSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const findBalanceUser = await db
      .collection("balanceUsers")
      .findOne({ user: userWithOutSpecLett });

    if (!findBalanceUser) {
      await db.collection("balanceUsers").insertOne({
        user: userWithOutSpecLett,
        balance: Number(req.body.value),
      });
    } else {
      await db.collection("balanceUsers").updateOne(
        {
          user: userWithOutSpecLett,
        },
        { $inc: { balance: Number(req.body.value) } }
      );
    }

    const body = {
      user: userWithOutSpecLett,
      description: req.body.description,
      value: req.body.value,
      date: `${dayjs(Date.now()).format("DD:MM")}`,
      type: "entrance",
    };
    await db.collection("history").insertOne(body);
    res.status(201).send({ message: `R$${req.body.value} depositado` });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

//Saida
app.post("/withdraw", async (req, res) => {
  const User = req.headers;
  const userWithOutSpecLett = decodeURIComponent(escape(User.user));

  if (!User.user) {
    res.status(422).send({ error: "Usuário necessário" });
    return;
  }

  const validation = entraceSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const findBalanceUser = await db
      .collection("balanceUsers")
      .findOne({ user: userWithOutSpecLett });

    if (!findBalanceUser) {
      await db.collection("balanceUsers").insertOne({
        user: userWithOutSpecLett,
        balance: -Number(req.body.value),
      });
    } else {
      await db.collection("balanceUsers").updateOne(
        {
          user: userWithOutSpecLett,
        },
        { $inc: { balance: -Number(req.body.value) } }
      );
    }

    const body = {
      user: userWithOutSpecLett,
      description: req.body.description,
      value: req.body.value,
      date: `${dayjs(Date.now()).format("DD:MM")}`,
      type: "withdraw",
    };
    await db.collection("history").insertOne(body);
    res
      .status(201)
      .send({ message: `R$${req.body.value} retirado da carteira` });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

//pegar histórico
app.get("/history", async (req, res) => {
  try {
    const response = await db.collection("history").find().toArray();
    const responseBalance = await db
      .collection("balanceUsers")
      .find()
      .toArray();
    res.send(response);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/balance", async (req, res) => {
  try {
    const response = await db.collection("balanceUsers").find().toArray();
    res.send(response);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

//Cadastro
app.post("/sing-up", async (req, res) => {});

//Login
app.post("/sing-in", async (req, res) => {});

app.listen(5000, () => console.log("Server listen on port 5000"));
