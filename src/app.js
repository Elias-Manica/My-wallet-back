import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
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
  value: joi.number().required().positive().messages({
    "number.positive": "O número deve ser positivo",
    "number.base": "O valor deve ser um número",
    "any.required": "Passar o valor é obrigatório",
  }),
  description: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/)
    .messages({
      "string.empty": "A descrição não pode ser vazia",
      "string.base": "A descrição deve ser um texto",
      "any.required": "Passar a descrição é obrigatório",
      "object.regex": "Essa descrição não deve ser utilizada",
      "string.pattern.base": "A descrição deve ter pelo menos uma letra",
    }),
  type: joi.string().required().valid("deposity", "withdraw").messages({
    "number.base": "O tipo deve ser um número",
    "any.required": "Passar o tipo é obrigatório",
    "string.empty": "O tipo não pode ser vazio",
    "any.only": `O tipo só pode ser "deposity" ou "withdraw"`,
  }),
});

const updateEntraceSchema = joi.object({
  value: joi.number().required().positive().messages({
    "number.positive": "O número deve ser positivo",
    "number.base": "O valor deve ser um número",
    "any.required": "Passar o valor é obrigatório",
  }),
  description: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/)
    .messages({
      "string.empty": "A descrição não pode ser vazia",
      "string.base": "A descrição deve ser um texto",
      "any.required": "Passar a descrição é obrigatório",
      "object.regex": "Essa descrição não deve ser utilizada",
      "string.pattern.base": "A descrição deve ter pelo menos uma letra",
    }),
  id: joi.string(),
});

const singupSchema = joi.object({
  name: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/)
    .messages({
      "string.empty": "O nome não pode ser vazio",
      "string.base": "O nome deve ser um texto",
      "any.required": "Passar o nome é obrigatório",
      "object.regex": "Esse nome não deve ser utilizado",
      "string.pattern.base": "O nome deve ter pelo menos uma letra",
    }),
  email: joi.string().required().empty("").email().messages({
    "string.empty": "O email não pode ser vazio",
    "string.base": "O email deve ser um texto",
    "any.required": "Passar o email é obrigatório",
    "string.email": "Este não é um email válido",
  }),
  password: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/)
    .messages({
      "string.empty": "A senha não pode ser vazia",
      "string.base": "A senha deve ser um texto",
      "any.required": "Passar a senha é obrigatório",
      "object.regex": "Essa senha não deve ser utilizada",
      "string.pattern.base": "A senha deve ter pelo menos uma letra",
    }),
});

const loginSchema = joi.object({
  email: joi.string().required().empty("").email().messages({
    "string.empty": "O email não pode ser vazio",
    "string.base": "O email deve ser um texto",
    "any.required": "Passar o email é obrigatório",
    "string.email": "Este não é um email válido",
  }),
  password: joi
    .string()
    .required()
    .empty("")
    .regex(/[a-zA-Z0-9]/)
    .messages({
      "string.empty": "A senha não pode ser vazia",
      "string.base": "A senha deve ser um texto",
      "any.required": "Passar a senha é obrigatório",
      "object.regex": "Essa senha não deve ser utilizada",
      "string.pattern.base": "A senha deve ter pelo menos uma letra",
    }),
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

        const update = await db.collection("sessions").updateOne(
          {
            userId: findUser._id,
          },
          { $set: { token: token } }
        );

        res.status(200).send({ email: findUser.email, token });
        return;
      } else {
        await db.collection("sessions").insertOne({
          userId: findUser._id,
          token,
        });
        res.status(200).send({ email: findUser.email, token });
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
//a

app.post("/sing-out", async (req, res) => {
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
      await db.collection("sessions").deleteOne({
        token,
      });
      res.send({ message: "Sessão encerrada" });
      return;
    } else {
      res.status(404).send({ message: "Nenhum usuário foi encontrado" });
      return;
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
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
      const user = await db.collection("users").findOne({
        _id: activeSession.userId,
      });

      delete user.password;

      await db.collection("transition").insertOne({
        idPerson: user._id,
        value,
        description,
        type,
        date: `${dayjs(Date.now()).format("DD/MM")}`,
      });

      const findBalanceUser = await db.collection("balanceUsers").findOne({
        userId: user._id,
      });

      if (findBalanceUser) {
        if (type === "withdraw") {
          await db.collection("balanceUsers").updateOne(
            {
              userId: user._id,
            },
            { $inc: { balance: -Number(value) } }
          );

          res.status(201).send({
            value: -Number(value),
            description,
            type,
            date: `${dayjs(Date.now()).format("DD/MM")}`,
          });
          return;
        } else {
          await db.collection("balanceUsers").updateOne(
            {
              userId: user._id,
            },
            { $inc: { balance: Number(value) } }
          );

          res.status(201).send({
            value: Number(value),
            description,
            type,
            date: `${dayjs(Date.now()).format("DD/MM")}`,
          });
          return;
        }
      } else {
        if (type === "withdraw") {
          await db.collection("balanceUsers").insertOne({
            userId: user._id,
            balance: -Number(value),
          });

          res.status(201).send({
            value: -Number(value),
            description,
            type,
            date: `${dayjs(Date.now()).format("DD/MM")}`,
          });
          return;
        } else {
          await db.collection("balanceUsers").insertOne({
            userId: user._id,
            balance: Number(value),
          });

          res.status(201).send({
            value: Number(value),
            description,
            type,
            date: `${dayjs(Date.now()).format("DD/MM")}`,
          });
          return;
        }
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

      let balance = 0;

      if (balanceUsers) {
        balance = balanceUsers.balance;
      }

      res.send({
        name: user.name,
        EmailUser: user.email,
        balance,
      });
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

app.delete("/delete", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { id } = req.body;

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  if (!id) {
    res.status(404).send({ message: "Id não enviado" });
    return;
  }

  console.log(id);

  try {
    const activeSession = await db.collection("sessions").findOne({
      token,
    });

    if (activeSession) {
      const transitionToBeDeleted = await db.collection("transition").findOne({
        _id: ObjectId(id),
      });
      if (transitionToBeDeleted) {
        await db.collection("transition").deleteOne({ _id: ObjectId(id) });

        res.send({ message: "Transição deletada" });
        return;
      } else {
        res.send({ message: "Não foi possível achar essa transição" });
        return;
      }
    } else {
      res.status(404).send({ message: "Token inválido" });
      return;
    }
  } catch (error) {
    res
      .status(401)
      .send({ message: "Erro no servidor ou no formato do ID enviado" });
    return;
  }
});

app.put("/transition", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { id } = req.body;

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  if (!id) {
    res.status(404).send({ message: "Id não enviado" });
    return;
  }

  const validation = updateEntraceSchema.validate(req.body, {
    abortEarly: false,
  });

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
      const transitionToBeUpdate = await db.collection("transition").findOne({
        _id: ObjectId(id),
      });
      if (transitionToBeUpdate) {
        await db
          .collection("transition")
          .updateOne({ _id: ObjectId(id) }, { $set: req.body });

        res.send({ message: "Transição modificada" });
        return;
      } else {
        res.send({ message: "Não foi possível achar essa transição" });
        return;
      }
    } else {
      res.status(404).send({ message: "Token inválido" });
      return;
    }
  } catch (error) {
    res
      .status(401)
      .send({ message: "Erro no servidor ou no formato do ID enviado" });
    return;
  }
});

app.listen(5000, () => console.log("Server listen on port 5000"));
