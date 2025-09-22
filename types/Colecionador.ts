import { CruzamentoVariado } from "./CruzamentoVariado";

export type Colecionador = {
  nick: string;
  linkPerfil: string;
  linkFigurinhas: string;
  frequencia: number;
  diasUltimoAcesso: number;
  cruzamento?: CruzamentoVariado;
};
