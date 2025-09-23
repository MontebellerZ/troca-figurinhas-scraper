import path from "path";

export const LOGIN = process.env.LOGIN;
export const SENHA = process.env.SENHA;

export const WORTH_MIN_FREQUENCIA = 3;
export const WORTH_MAX_ULTIMOACESSO = 10;

export const TOTAL_WORKERS = 8;

export const COLECIONADORES_FILE = path.resolve(__dirname, "../data/colecionadores.json");
export const DIAS_EXPIRACAO_COLECIONADORES_FILE = 1;

export const REGEX_FIGURINHA = /^(\d+|HK\d+)(\s*,\s*(\d+|HK\d+))*$/;
