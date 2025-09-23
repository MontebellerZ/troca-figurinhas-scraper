import puppeteer, { Browser, BrowserContext, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import { Colecionador } from "../types/Colecionador";
import { ColecionadoresSalvos } from "../types/ColecionadoresSalvos";
import { CruzamentoVariado } from "../types/CruzamentoVariado";
import {
  COLECIONADORES_FILE,
  DIAS_EXPIRACAO_COLECIONADORES_FILE,
  LOGIN,
  REGEX_FIGURINHA,
  SENHA,
  TOTAL_WORKERS,
  WORTH_MAX_ULTIMOACESSO,
  WORTH_MIN_FREQUENCIA,
} from "../contants/constants";
import { LINKS } from "../contants/links";
import { SELECTORS } from "../contants/selectors";
import ConsoleColors from "../contants/consoleColors";

export default class TrocaFigurinhas {
  readonly inicializado: Promise<void>;

  private browser: Browser;
  private context: BrowserContext;
  private page: Page;
  private colecionadores: Colecionador[];

  constructor(browser?: Browser, url?: string) {
    this.inicializado = browser ? this.reaproveitar(browser, url) : this.inicializar();
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((res) => setTimeout(res, ms));
  }

  private async esperarModalRestricao(): Promise<void> {
    await this.wait(500); // espera o modal de restrição para caso ele aparecer

    const retricaoSelector = SELECTORS.restricao;
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
    await this.goto(LINKS.base);
  }

  private async reaproveitar(browser: Browser, url?: string): Promise<void> {
    this.browser = browser;
    this.context = await browser.createBrowserContext();

    const cookies = await browser.cookies();
    if (cookies.length > 0) await this.context.setCookie(...cookies);

    this.page = await this.context.newPage();
    await this.goto(url || LINKS.base);
  }

  async finalizarPage(): Promise<void> {
    await this.page.close();
  }

  async finalizar(): Promise<void> {
    await this.browser.close();
  }

  async login(): Promise<void> {
    const selectors = SELECTORS.login;

    await this.page.locator(selectors.nick).fill(LOGIN);
    await this.page.locator(selectors.senha).fill(SENHA);
    await this.page.locator(selectors.submit).click();
    await this.waitForNavigation();
  }

  private async findAlbumOption(selectSelector: string, album: string) {
    const select = await this.page.waitForSelector(selectSelector);

    return await select.$$eval(
      "option",
      (options, album) => {
        for (let option of options) {
          if (option.textContent.trim() === album) return option.value;
        }
        return null;
      },
      album
    );
  }

  private async selecionarAlbumPagina(album: string): Promise<void> {
    const selectors = SELECTORS.listaColecionadores.filtro;

    await this.page.locator(selectors.aba).click();

    const optionAlbum = await this.findAlbumOption(selectors.select, album);

    if (optionAlbum) await this.page.select(selectors.select, optionAlbum);
    else throw new Error(`Álbum "${album}" não encontrado no select da lista`);

    await this.wait(2000);

    await this.page.locator(selectors.submit).click();

    await this.waitForNavigation();
  }

  private async obterDadosColecionadoresPagina(): Promise<Colecionador[]> {
    const tableId = SELECTORS.listaColecionadores.tabela.selector;
    const table = await this.page.waitForSelector(tableId);

    const selectors = SELECTORS.listaColecionadores.tabela.colecionador;

    const perfis: Colecionador[] = await table.$$eval(
      selectors.selector,
      (divsPerfil, selectors, minFrequencia, maxUltimoAcesso) => {
        const filterPresenca = (p: HTMLDivElement) =>
          p.classList.contains("P") || p.classList.contains("PP");

        return divsPerfil.map((p) => {
          const nick = (p.querySelector(selectors.nick) ||
            p.querySelector(selectors.nick2)) as HTMLSpanElement;
          const perfil = p.querySelector(selectors.perfil) as HTMLAnchorElement;
          const figurinhas = p.querySelector(selectors.figurinhas) as HTMLAnchorElement;
          const presenca = Array.from<HTMLDivElement>(p.querySelectorAll(selectors.presenca));

          const frequencia = presenca.filter(filterPresenca).length;
          const diasUltimoAcesso = frequencia > 0 ? presenca.findIndex(filterPresenca) : null;
          const worth = frequencia >= minFrequencia && diasUltimoAcesso <= maxUltimoAcesso;

          const colecionador: Colecionador = {
            nick: nick?.innerText,
            linkPerfil: perfil?.href,
            linkFigurinhas: figurinhas?.href,
            frequencia: frequencia,
            diasUltimoAcesso: diasUltimoAcesso,
            worth: worth,
          };

          return colecionador;
        });
      },
      selectors,
      WORTH_MIN_FREQUENCIA,
      WORTH_MAX_ULTIMOACESSO
    );

    return perfis;
  }

  private async proximaPagina(): Promise<boolean> {
    const tableId = SELECTORS.listaColecionadores.tabela.selector;
    const table = await this.page.waitForSelector(tableId);

    const pageSelector = SELECTORS.listaColecionadores.tabela.paginacao.proxima;

    const nextPageLink = await table.$(pageSelector);

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

    await this.goto(LINKS.localizarColecionadores);

    await this.selecionarAlbumPagina(album);

    this.colecionadores = [];

    do {
      const perfis = await this.obterDadosColecionadoresPagina();
      this.colecionadores.push(...perfis);
    } while (await this.proximaPagina());

    this.salvarColecionadores(this.colecionadores);

    return this.colecionadores;
  }

  private async selecionarAlbumPerfil(album: string) {
    const selectors = SELECTORS.colecionador.albuns;

    await this.page.locator(selectors.trocarAlbum).click();

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
      selectors.selectIncompletos,
      selectors.submitIncompletos
    );
    if (selecionadoIncompleto) return;

    const selecionadoCompleto = await selecionar(
      selectors.selectCompletos,
      selectors.submitCompletos
    );
    if (selecionadoCompleto) return;

    throw new Error(`Álbum "${album}" não encontrado nos selects do perfil`);
  }

  private async verificarCruzamentoVariado(): Promise<CruzamentoVariado> {
    const selectors = SELECTORS.colecionador.cruzamento;

    await this.page.locator(selectors.aba).click();

    const lerFigurinhas = async (selector: string): Promise<string[]> => {
      const element = await this.page.waitForSelector(selector);
      const text = await element.evaluate((el) => el.textContent.trim());
      if (!REGEX_FIGURINHA.test(text)) return [];
      return text.split(", ");
    };

    const tem = await lerFigurinhas(selectors.figurinhas.tem);
    const falta = await lerFigurinhas(selectors.figurinhas.falta);

    const cruzamento: CruzamentoVariado = { falta, tem };

    return cruzamento;
  }

  private async workerEncontrarFigurinhas(
    colecionadores: Colecionador[],
    album: string
  ): Promise<void> {
    const duracao = (t: Date) => `${((Date.now() - t.valueOf()) / 1000).toFixed(2)}s`;

    while (colecionadores.length) {
      const inicio = new Date();

      const colecionador = colecionadores.shift();

      if (colecionador.buscaFalhou) {
        ConsoleColors.info(`Figurinhas - Repetindo: ${colecionador.nick}`, ConsoleColors.FgYellow);
      } else {
        ConsoleColors.info(`Figurinhas - Iniciando: ${colecionador.nick}`, ConsoleColors.FgCyan);
      }

      try {
        await this.goto(colecionador.linkFigurinhas);

        await this.selecionarAlbumPerfil(album);

        const cruzamento = await this.verificarCruzamentoVariado();

        colecionador.cruzamento = cruzamento;
        colecionador.buscaFalhou = undefined;

        ConsoleColors.info(
          `Figurinhas - Finalizado: ${colecionador.nick} - ${duracao(inicio)}`,
          ConsoleColors.FgGreen
        );
      } catch (err) {
        ConsoleColors.error(
          `Figurinhas - Erro: ${colecionador.nick} - ${duracao(inicio)}`,
          ConsoleColors.FgRed
        );

        if (colecionador.buscaFalhou) continue;

        colecionador.buscaFalhou = true;
        colecionadores.push(colecionador);
      }
    }

    await this.finalizarPage();
  }

  async encontrarFigurinhas(album: string): Promise<Colecionador[]> {
    if (!this.colecionadores) return;

    const worth = this.colecionadores.filter((c) => c.worth);
    const sites = new Array(TOTAL_WORKERS).fill(0).map(() => new TrocaFigurinhas(this.browser));

    await Promise.all(sites.map(async (s) => await s.inicializado));

    const buscas = sites.map(async (site) => await site.workerEncontrarFigurinhas(worth, album));

    await Promise.all(buscas);

    this.salvarColecionadores(this.colecionadores);
  }

  private salvarColecionadores(colecionadores: Colecionador[]): void {
    const colecionadoresJson: ColecionadoresSalvos = { date: new Date().getTime(), colecionadores };

    const dir = path.dirname(COLECIONADORES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(COLECIONADORES_FILE, JSON.stringify(colecionadoresJson, null, 2));
  }

  private buscarSalvosColecionadores(): Colecionador[] {
    if (!fs.existsSync(COLECIONADORES_FILE)) return null;

    const salvos: ColecionadoresSalvos = require(COLECIONADORES_FILE);

    const dataSalvos = new Date(salvos.date);
    dataSalvos.setDate(dataSalvos.getDate() + DIAS_EXPIRACAO_COLECIONADORES_FILE);

    if (dataSalvos <= new Date()) return null;

    salvos.colecionadores.forEach((c) => (c.buscaFalhou = undefined));
    return salvos.colecionadores;
  }
}
