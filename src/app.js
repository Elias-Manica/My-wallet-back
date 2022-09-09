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
  type: joi.string().required().valid("deposity", "withdraw"),
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

app.post("/transition", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { value, description, type } = req.body;

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  const validation = entraceSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const activeSession = await db.collection("sessions").findOne({
      token,
    });

    if (activeSession) {
      console.log(activeSession);

      const user = await db.collection("users").findOne({
        _id: activeSession.userId,
      });

      delete user.password;

      await db.collection("transition").insertOne({
        idPerson: user._id,
        value,
        description,
        type,
        date: `${dayjs(Date.now()).format("DD:MM")}`,
      });

      const findBalanceUser = await db.collection("balanceUsers").findOne({
        userId: user._id,
      });

      if (findBalanceUser) {
        if (type === "deposity") {
          await db.collection("balanceUsers").updateOne(
            {
              userId: user._id,
            },
            { $inc: { balance: Number(value) } }
          );

          res.status(201).send({
            value,
            description,
            type,
            date: `${dayjs(Date.now()).format("DD:MM")}`,
          });
          return;
        } else {
          await db.collection("balanceUsers").updateOne(
            {
              userId: user._id,
            },
            { $inc: { balance: -Number(value) } }
          );

          res.status(201).send({
            value,
            description,
            type,
            date: `${dayjs(Date.now()).format("DD:MM")}`,
          });
          return;
        }
      } else {
        await db.collection("balanceUsers").insertOne({
          userId: user._id,
          balance: Number(value),
        });

        res.status(201).send({
          value,
          description,
          type,
          date: `${dayjs(Date.now()).format("DD:MM")}`,
        });
        return;
      }
    } else {
      res.status(404).send({ message: "Token inválido" });
      return;
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
    return;
  }
});

//pegar histórico
app.get("/transition", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  try {
    const activeSession = await db.collection("sessions").findOne({
      token,
    });

    if (activeSession) {
      const user = await db.collection("users").findOne({
        _id: activeSession.userId,
      });

      const transitionsUsers = await db
        .collection("transition")
        .find()
        .toArray();

      const transitionFiltered = transitionsUsers.filter(
        (value) => value.idPerson.toHexString() === user._id.toHexString()
      );

      res.send(transitionFiltered.reverse());
      return;
    } else {
      res.status(404).send({ message: "Token inválido" });
      return;
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/balance", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  try {
    const activeSession = await db.collection("sessions").findOne({
      token,
    });

    if (activeSession) {
      const user = await db.collection("users").findOne({
        _id: activeSession.userId,
      });

      const balanceUsers = await db
        .collection("balanceUsers")
        .findOne({ userId: user._id });

      res.send({ EmailUser: user.email, balance: balanceUsers.balance });
      return;
    } else {
      res.status(404).send({ message: "Token inválido" });
      return;
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log("Server listen on port 5000"));
