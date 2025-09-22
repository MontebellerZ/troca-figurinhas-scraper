import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import { Colecionador } from "../types/Colecionador";
import { ColecionadoresSalvos } from "../types/ColecionadoresSalvos";
import { CruzamentoVariado } from "../types/CruzamentoVariado";

const LOGIN = process.env.LOGIN;
const SENHA = process.env.SENHA;
const COLECIONADORES_FILE = "./colecionadores.json";
const DIAS_EXPIRACAO_COLECIONADORES_FILE = 1;

export default class TrocaFigurinhas {
  readonly inicializado: Promise<void>;

  private browser: Browser;
  private page: Page;

  colecionadores: Colecionador[];

  constructor(browser?: Browser, url?: string) {
    this.inicializado = browser ? this.reaproveitar(browser, url) : this.inicializar();
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((res) => setTimeout(res, ms));
  }

  private async esperarModalRestricao(): Promise<void> {
    await this.wait(500); // espera o modal de restrição para caso ele aparecer

    const retricaoSelector = "#ctl00_upRestricao";
    const restricao = await this.page.$(retricaoSelector);
    if (!restricao) return;

    await restricao.evaluate((el: HTMLDivElement) => (el.style.display = "none"));
  }

  private async goto(...args: Parameters<Page["goto"]>): ReturnType<Page["goto"]> {
    const resp = await this.page.goto(...args);
    await this.esperarModalRestricao();
    return resp;
  }

  private async waitForNavigation(
    ...args: Parameters<Page["waitForNavigation"]>
  ): ReturnType<Page["waitForNavigation"]> {
    const resp = await this.page.waitForNavigation(...args);
    await this.esperarModalRestricao();
    return resp;
  }

  private async inicializar(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--window-size=1080,720"],
    });
    this.page = (await this.browser.pages())[0];
    await this.goto("https://trocafigurinhas.com/");
  }

  private async reaproveitar(browser: Browser, url?: string): Promise<void> {
    this.browser = browser;
    this.page = await this.browser.newPage();
    await this.goto(url || "https://trocafigurinhas.com/");
  }

  async finalizarPage(): Promise<void> {
    await this.page.close();
  }

  async finalizar(): Promise<void> {
    await this.wait(5000);
    await this.browser.close();
  }

  async login(): Promise<void> {
    await this.page.locator("#ctl00_lvUser_ucNL_txtLogin").fill(LOGIN);
    await this.page.locator("#ctl00_lvUser_ucNL_txtSenha").fill(SENHA);
    await this.page.locator("#ctl00_lvUser_ucNL_btnLogin").click();
    await this.waitForNavigation();
  }

  async findAlbumOption(selectSelector: string, album: string) {
    await this.page.waitForSelector(selectSelector);

    return await this.page.evaluate(
      (selectId, album) => {
        const select = document.querySelector(selectId);
        const options = Array.from(select.querySelectorAll("option"));

        for (let option of options) {
          if (option.textContent.trim() === album) return option.value;
        }
        return null;
      },
      selectSelector,
      album
    );
  }

  async selecionarAlbumPagina(album: string): Promise<void> {
    await this.page.locator("#ctl00_CPH_ucFiltrar_AccordionPane1_header > div.Filtro").click();

    const selectId = "#ctl00_CPH_ucFiltrar_AccordionPane1_content_ddlAlbuns_ColecionadoresBusca";

    const optionAlbum = await this.findAlbumOption(selectId, album);

    if (optionAlbum) await this.page.select(selectId, optionAlbum);
    else throw new Error(`Álbum "${album}" não encontrado no select`);

    await this.wait(2000);

    await this.page.locator("#ctl00_CPH_ucFiltrar_AccordionPane1_content_Button4").click();

    await this.waitForNavigation();
  }

  async obterDadosColecionadoresPagina(): Promise<Colecionador[]> {
    const tableId = "#ctl00_CPH_gvColecionadores";

    await this.page.waitForSelector(tableId);

    const perfis: Colecionador[] = await this.page.$$eval(
      `${tableId} div.PerfilListas-Content:has(a.PerfilListas-Figurinhas)`,
      (divsPerfil) =>
        divsPerfil.map((p) => {
          const nick = p.querySelector("span.LoginPerfil") as HTMLSpanElement;
          const perfil = p.querySelector(".PerfilListas-Content-Avatar > a") as HTMLAnchorElement;
          const figurinhas = p.querySelector("a.PerfilListas-Figurinhas") as HTMLAnchorElement;
          const presenca = Array.from<HTMLDivElement>(p.querySelectorAll(".Presenca > div"));

          const frequencia = presenca.filter(
            (p) => p.classList.contains("P") || p.classList.contains("PP")
          ).length;

          const diasUltimoAcesso =
            frequencia > 0
              ? presenca.findIndex((p) => p.classList.contains("P") || p.classList.contains("PP"))
              : null;

          const colecionador: Colecionador = {
            nick: nick?.innerText,
            linkPerfil: perfil?.href,
            linkFigurinhas: figurinhas?.href,
            frequencia: frequencia,
            diasUltimoAcesso: diasUltimoAcesso,
          };

          return colecionador;
        })
    );

    return perfis;
  }

  async proximaPagina(): Promise<boolean> {
    const tableId = "#ctl00_CPH_gvColecionadores";

    await this.page.waitForSelector(tableId);

    const pageSelector = `${tableId} tr.gvPagerPadrao td:has(span) + td > a`;

    const nextPageLink = await this.page.$(pageSelector);

    if (!nextPageLink) return false;

    await this.wait(500);

    try {
      await nextPageLink.click();
      await this.waitForNavigation({ timeout: 5000 });
    } catch (err) {
      // Tenta ao menos duas vezes
      await nextPageLink.click();
      await this.waitForNavigation();
    }

    return true;
  }

  async encontrarColecionadores(album: string): Promise<Colecionador[]> {
    this.colecionadores = this.buscarSalvosColecionadores();
    if (this.colecionadores) return this.colecionadores;

    await this.goto("https://trocafigurinhas.com/colecionadores/localizar-colecionadores.html");

    await this.selecionarAlbumPagina(album);

    this.colecionadores = [];

    do {
      const perfis = await this.obterDadosColecionadoresPagina();
      this.colecionadores.push(...perfis);
    } while (await this.proximaPagina());

    this.salvarColecionadores(this.colecionadores);

    return this.colecionadores;
  }

  async selecionarAlbumPerfil(album: string) {
    await this.page
      .locator(
        "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpAlbumSelecionado > div > div.Album-Selecao-TrocarAlbum > a"
      )
      .click();

    const selectIncompletosId =
      "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_ddlAlbunsIncompletos";
    const selectCompletosId = "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_ddlAlbunsIncompletos";

    await Promise.all([
      this.page.waitForSelector(selectIncompletosId),
      this.page.waitForSelector(selectCompletosId),
    ]);

    const selecionar = async (selectSelector: string, submitSelector: string) => {
      const option = await this.findAlbumOption(selectSelector, album);
      if (option) {
        await this.page.select(selectSelector, option);
        await this.wait(2000);
        await this.page.locator(submitSelector).click();
        await this.waitForNavigation();
        return true;
      }
      return false;
    };

    const selecionadoIncompleto = await selecionar(
      selectIncompletosId,
      "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_imgSelecionarAlbumIncompleto"
    );
    if (selecionadoIncompleto) return;

    const selecionadoCompleto = await selecionar(
      selectCompletosId,
      "#ctl00_CPH_uc_AlbunsDoUsuario_tcAlbum_tpTrocar_imgSelecionarAlbumCompleto"
    );
    if (selecionadoCompleto) return;

    throw new Error(`Álbum "${album}" não encontrado nos selects do perfil`);
  }

  async verificarCruzamentoVariado(): Promise<CruzamentoVariado> {
    await this.page.locator("#__tab_ctl00_CPH_tabcFigurinhas_tabpCruzamento").click();

    const lerFigurinhas = async (selector: string): Promise<string[]> => {
      const element = await this.page.locator(selector).waitHandle();
      const text = await element.evaluate((el) => el.textContent);
      return text.split(", ");
    };

    const temSelector = "#ctl00_CPH_tabcFigurinhas_tabpCruzamento_lblConteudoAEnviar";
    const faltaSelector = "#ctl00_CPH_tabcFigurinhas_tabpCruzamento_lblConteudoAReceber";

    await Promise.all([
      this.page.waitForSelector(temSelector),
      this.page.waitForSelector(faltaSelector),
    ]);

    const tem = await lerFigurinhas(temSelector);
    const falta = await lerFigurinhas(faltaSelector);

    const cruzamento: CruzamentoVariado = { falta, tem };

    return cruzamento;
  }

  async encontrarFigurinhas(album: string): Promise<Colecionador[]> {
    if (!this.colecionadores) return;

    const buscarFigurinhasPerfil = async (colecionador: Colecionador) => {
      const site = new TrocaFigurinhas(this.browser, colecionador.linkFigurinhas);
      await site.inicializado;

      await site.selecionarAlbumPerfil(album);

      const cruzamento = await site.verificarCruzamentoVariado();

      await site.finalizarPage();

      colecionador.cruzamento = cruzamento;

      return colecionador;
    };

    const awaitResultados = this.colecionadores.map(
      (c) => async () => await buscarFigurinhasPerfil(c)
    );

    this.salvarColecionadores(this.colecionadores);
  }

  salvarColecionadores(colecionadores: Colecionador[]): void {
    const colecionadoresJson: ColecionadoresSalvos = { date: new Date().getTime(), colecionadores };
    fs.writeFileSync(COLECIONADORES_FILE, JSON.stringify(colecionadoresJson, null, 4));
  }

  buscarSalvosColecionadores(): Colecionador[] {
    if (!fs.existsSync(COLECIONADORES_FILE)) return null;

    const salvos: ColecionadoresSalvos = require(COLECIONADORES_FILE);

    const dataSalvos = new Date(salvos.date);
    dataSalvos.setDate(dataSalvos.getDate() + DIAS_EXPIRACAO_COLECIONADORES_FILE);

    if (dataSalvos > new Date()) return salvos.colecionadores;

    return null;
  }
}
