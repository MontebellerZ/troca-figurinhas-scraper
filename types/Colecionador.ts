import { CruzamentoVariado } from "./CruzamentoVariado";

export type Colecionador = {
  nick: string;
  linkPerfil: string;
  linkFigurinhas: string;
  frequencia: number;
  diasUltimoAcesso: number;
  worth: boolean;
  cruzamento?: CruzamentoVariado;
  buscaFalhou?: true;
};
