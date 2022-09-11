import db from "../database/db.js";

import { ObjectId } from "mongodb";

import joi from "joi";
import dayjs from "dayjs";

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

async function createTransition(req, res) {
  const token = res.locals.token;
  const { value, description, type } = req.body;

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
    res.status(500).send({ message: "erro no servidor" });
    return;
  }
}

async function deleteTransition(req, res) {
  const token = res.locals.token;
  const { id } = req.body;

  if (!id) {
    res.status(404).send({ message: "Id não enviado" });
    return;
  }

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

        if (transitionToBeDeleted.type === "deposity") {
          await db.collection("balanceUsers").updateOne(
            {
              userId: transitionToBeDeleted.idPerson,
            },
            { $inc: { balance: -Number(transitionToBeDeleted.value) } }
          );
        } else {
          await db.collection("balanceUsers").updateOne(
            {
              userId: transitionToBeDeleted.idPerson,
            },
            { $inc: { balance: Number(transitionToBeDeleted.value) } }
          );
        }

        res.send({ message: "Transição deletada" });
        return;
      } else {
        res
          .status(404)
          .send({ message: "Não foi possível achar essa transição" });
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
}

async function getTransitions(req, res) {
  const token = res.locals.token;

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
}

async function updateTransition(req, res) {
  const token = res.locals.token;
  const { id } = req.body;

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

        if (transitionToBeUpdate.type === "deposity") {
          await db.collection("balanceUsers").updateOne(
            {
              userId: transitionToBeUpdate.idPerson,
            },
            {
              $inc: {
                balance: Number(req.body.value - transitionToBeUpdate.value),
              },
            }
          );
        } else {
          await db.collection("balanceUsers").updateOne(
            {
              userId: transitionToBeUpdate.idPerson,
            },
            {
              $inc: {
                balance: -Number(req.body.value - transitionToBeUpdate.value),
              },
            }
          );
        }

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
}

async function getBalance(req, res) {
  const token = res.locals.token;

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
}

export {
  createTransition,
  getTransitions,
  getBalance,
  deleteTransition,
  updateTransition,
};
