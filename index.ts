import "dotenv/config";
import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";

const LOGIN = process.env.LOGIN;
const SENHA = process.env.SENHA;
const COLECIONADORES_FILE = "./colecionadores.json";
const DIAS_EXPIRACAO_COLECIONADORES_FILE = 1;

type ColecionadoresSalvos = {
  date: number;
  colecionadores: string[];
};

class TrocaFigurinhas {
  readonly inicializado: Promise<void>;
  browser: Browser;
  page: Page;

  constructor() {
    this.inicializado = this.inicializar();
  }

  private async wait(ms: number) {
    await new Promise((res) => setTimeout(res, ms));
  }

  private async inicializar() {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--window-size=1080,720"],
    });
    this.page = (await this.browser.pages())[0];
    await this.page.goto("https://trocafigurinhas.com/");
  }

  async finalizar() {
    await this.wait(5000);
    await this.browser.close();
  }

  async login() {
    await this.page.locator("#ctl00_lvUser_ucNL_txtLogin").fill(LOGIN);
    await this.page.locator("#ctl00_lvUser_ucNL_txtSenha").fill(SENHA);
    await this.page.locator("#ctl00_lvUser_ucNL_btnLogin").click();
    await this.page.waitForNavigation();
  }

  async selecionarColecionadoresAlbum(album: string) {
    await this.page.locator("#ctl00_CPH_ucFiltrar_AccordionPane1_header > div.Filtro").click();

    const selectId = "#ctl00_CPH_ucFiltrar_AccordionPane1_content_ddlAlbuns_ColecionadoresBusca";

    await this.page.waitForSelector(selectId);

    const optionAlbum = await this.page.evaluate(
      (selectId, album) => {
        const select = document.querySelector(selectId);
        const options = Array.from(select.querySelectorAll("option"));

        for (let option of options) {
          if (option.textContent.trim() === album) return option.value;
        }
        return null;
      },
      selectId,
      album
    );

    if (optionAlbum) await this.page.select(selectId, optionAlbum);
    else throw new Error(`Álbum "${album}" não encontrado no select`);

    await this.wait(2000);

    await this.page.locator("#ctl00_CPH_ucFiltrar_AccordionPane1_content_Button4").click();

    await this.page.waitForNavigation();
  }

  async obterLinksColecionadores() {
    const tableId = "#ctl00_CPH_gvColecionadores";

    await this.page.waitForSelector(tableId);

    const hrefs = await this.page.$$eval(`${tableId} a.PerfilListas-Figurinhas`, (links) =>
      links.map((link) => link.href)
    );

    return hrefs;
  }

  async proximaPagina() {
    const tableId = "#ctl00_CPH_gvColecionadores";

    await this.page.waitForSelector(tableId);

    const pageSelector = `${tableId} tr.gvPagerPadrao td:has(span) + td > a`;

    const nextPageLink = await this.page.$(pageSelector);

    if (!nextPageLink) return false;

    await this.wait(500);

    try {
      await nextPageLink.click();
      await this.page.waitForNavigation({ timeout: 5000 });
    } catch (err) {
      // Tenta ao menos duas vezes
      await nextPageLink.click();
      await this.page.waitForNavigation();
    }

    return true;
  }

  async encontrarColecionadores(album: string) {
    const salvosColecionadores = this.buscarSalvosColecionadores();
    if (salvosColecionadores) return salvosColecionadores;

    await this.page.goto(
      "https://trocafigurinhas.com/colecionadores/localizar-colecionadores.html"
    );

    await this.selecionarColecionadoresAlbum(album);

    const linksColecionadores = [];

    do {
      const links = await this.obterLinksColecionadores();
      linksColecionadores.push(...links);
    } while (await this.proximaPagina());

    this.salvarColecionadores(linksColecionadores);

    return linksColecionadores;
  }

  salvarColecionadores(colecionadores: string[]) {
    const colecionadoresJson: ColecionadoresSalvos = { date: new Date().getTime(), colecionadores };
    fs.writeFileSync(COLECIONADORES_FILE, JSON.stringify(colecionadoresJson, null, 4));
  }

  buscarSalvosColecionadores() {
    if (!fs.existsSync(COLECIONADORES_FILE)) return null;

    const salvos: ColecionadoresSalvos = require(COLECIONADORES_FILE);

    const dataSalvos = new Date(salvos.date);
    dataSalvos.setDate(dataSalvos.getDate() + DIAS_EXPIRACAO_COLECIONADORES_FILE);

    if (dataSalvos > new Date()) return salvos.colecionadores;

    return null;
  }
}

async function main() {
  const site = new TrocaFigurinhas();
  await site.inicializado;

  await site.login();

  const album = "Hello Kitty and Friends";

  const colecionadores = await site.encontrarColecionadores(album);

  console.log(colecionadores);

  await site.finalizar();
}

main()
  .then(() => console.info("Finalizado com sucesso"))
  .catch((err) => console.error("Finalizado com erro: ", err));
