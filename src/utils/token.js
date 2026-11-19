import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

export const verifyToken = (token) => jwt.verify(token, config.jwt.secret);
