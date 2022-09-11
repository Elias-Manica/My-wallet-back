import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import joi from "joi";
import db from "../database/db.js";

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

async function singUp(req, res) {
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
    console.log(error);
    res.status(500).send({ message: "Erro no servidor" });
  }
}

async function login(req, res) {
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
        await db.collection("sessions").findOne({
          userId: findUser._id,
        });

        await db.collection("sessions").updateOne(
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
    res.status(500).send({ message: "Erro no servidor" });
    return;
  }
}

async function singOut(req, res) {
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
}

export { singUp, login, singOut };
