import "dotenv/config";
import TrocaFigurinhas from "./classes/TrocaFigurinhas";

async function main() {
  const site = new TrocaFigurinhas();
  await site.inicializado;

  await site.login();

  const album = "Hello Kitty and Friends";

  const colecionadores = await site.encontrarColecionadores(album);

  await site.encontrarFigurinhas(album);

  await site.finalizar();
}

main()
  .then(() => console.info("Finalizado com sucesso"))
  .catch((err) => console.error("Finalizado com erro: ", err));
