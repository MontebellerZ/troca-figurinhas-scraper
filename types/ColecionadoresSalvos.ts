import { Colecionador } from "./Colecionador";

export type ColecionadoresSalvos = {
  [album: string]: {
    date: number;
    colecionadores: Colecionador[];
  };
};
