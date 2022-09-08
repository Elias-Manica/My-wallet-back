import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

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

const singupSchema = joi.object({
  name: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/),
  email: joi.string().required().empty("").email(),
  password: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/),
});

const loginSchema = joi.object({
  email: joi.string().required().empty("").email(),
  password: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/),
});

//Cadastro
app.post("/sing-up", async (req, res) => {
  const { name, email, password } = req.body;

  const validation = singupSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    const findUser = await db.collection("users").findOne({ email });
    if (findUser) {
      res.status(401).send({ message: "Email já cadastrado" });
      return;
    } else {
      await db
        .collection("users")
        .insertOne({ name, email, password: passwordHash });
      return res.status(201).send({ message: "Email cadastrado com sucesso" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

//Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const validation = loginSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const findUser = await db.collection("users").findOne({ email });

    if (findUser && bcrypt.compareSync(password, findUser.password)) {
      const token = uuid();

      const findSession = await db.collection("sessions").findOne({
        userId: findUser._id,
      });

      if (findSession) {
        const response = await db.collection("sessions").findOne({
          userId: findUser._id,
        });
        console.log(response);
        const update = await db.collection("sessions").updateOne(
          {
            userId: findUser._id,
          },
          { $set: { token: token } }
        );
        console.log(update);
        res.status(200).send(token);
        return;
      } else {
        await db.collection("sessions").insertOne({
          userId: findUser._id,
          token,
        });
        res.status(200).send(token);
        return;
      }
    } else {
      res.status(404).send({ message: "Email ou Senha incorretos" });
      return;
    }
  } catch (error) {
    res.status(500).send(error);
    return;
  }
});

app.post("/transition", async (req, res) => {});

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

app.listen(5000, () => console.log("Server listen on port 5000"));
