import "dotenv/config";
import TrocaFigurinhas from "./classes/TrocaFigurinhas";
import ConsoleColors from "./utils/consoleColors";

async function main() {
  const site = new TrocaFigurinhas();
  await site.inicializado;

  await site.login();

  const album = "Hello Kitty and Friends";

  await site.encontrarColecionadores(album);

  await site.encontrarFigurinhas(album);

  await site.finalizar();
}

main()
  .then(() => ConsoleColors.info("Finalizado com sucesso"))
  .catch((err) => {
    ConsoleColors.error(`Finalizado com erro: ${err}`);
    throw err;
  });
