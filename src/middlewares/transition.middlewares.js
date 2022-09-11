function hasToken(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).send({ message: "Token de acesso não enviado" });
    return;
  }

  res.locals.token = token;

  next();
}

export default hasToken;
