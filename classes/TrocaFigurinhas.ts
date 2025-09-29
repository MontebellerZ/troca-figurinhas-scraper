import puppeteer, { Browser, BrowserContext, Cookie, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import { Colecionador } from "../types/Colecionador";
import { ColecionadoresSalvos as ColecionadoresAlbumSalvos } from "../types/ColecionadoresSalvos";
import { CruzamentoVariado } from "../types/CruzamentoVariado";
import {
  COLECIONADORES_FILE,
  DIAS_EXPIRACAO_COLECIONADORES_FILE,
  LOGIN,
  PAGINACAO_COLECIONADORES_EVENTTARGET,
  PAGINACAO_COLECIONADORES_SIZE,
  REGEX_FIGURINHA,
  SENHA,
  TOTAL_WORKERS,
  WORTH_MAX_ULTIMOACESSO,
  WORTH_MIN_FREQUENCIA,
} from "../contants/constants";
import { LINKS } from "../contants/links";
import { SELECTORS } from "../contants/selectors";
import ConsoleColors from "../utils/consoleColors";
import { ColecionadorPaginacaoBloco } from "../types/ColecionadorPaginacao";
import { tempoCorrido } from "../utils/tempoCorrido";
import axios from "axios";
import { SiteRequest } from "../types/SiteRequest";
import { PageData } from "../types/PageData";
import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";

export default class TrocaFigurinhas {
  public readonly inicializado: Promise<void>;

  private browser: Browser;
  private context: BrowserContext;
  private page: Page;
  private colecionadores: Colecionador[];

  private get cookies(): Promise<Cookie[]> {
    return this.browser?.cookies();
  }

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

  public async duplicar(url?: string): Promise<TrocaFigurinhas> {
    const site = new TrocaFigurinhas(this.browser, url || this.page.url());
    await site.inicializado;
    return site;
  }

  private async inicializar(): Promise<void> {
    ConsoleColors.info(`TrocaFigurinhas - Inicializando`);
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--window-size=1080,720"],
    });
    this.page = (await this.browser.pages())[0];
    await this.goto(LINKS.base);
    ConsoleColors.success(`TrocaFigurinhas - Inicializado`);
  }

  private async reaproveitar(browser: Browser, url?: string): Promise<void> {
    ConsoleColors.info(`TrocaFigurinhas - Abrindo nova aba`);
    this.browser = browser;
    this.context = await browser.createBrowserContext();

    ConsoleColors.info(`TrocaFigurinhas - Copiando cookies para nova aba`);
    const cookies = await browser.cookies();
    if (cookies.length > 0) await this.context.setCookie(...cookies);

    this.page = await this.context.newPage();
    await this.goto(url || LINKS.base);
    ConsoleColors.success(`TrocaFigurinhas - Nova aba aberta`);
  }

  public async finalizarPage(): Promise<void> {
    ConsoleColors.info(`TrocaFigurinhas - Fechando aba`);
    await this.page.close();
    ConsoleColors.success(`TrocaFigurinhas - Aba fechada`);
  }

  public async finalizar(): Promise<void> {
    ConsoleColors.info(`TrocaFigurinhas - Finalizando navegador`);
    await this.browser.close();
    ConsoleColors.success(`TrocaFigurinhas - Navegador finalizado`);
  }

  public async login(): Promise<void> {
    ConsoleColors.info(`TrocaFigurinhas - Realizando login`);
    const selectors = SELECTORS.login;

    await this.page.locator(selectors.nick).fill(LOGIN);
    await this.page.locator(selectors.senha).fill(SENHA);
    await this.page.locator(selectors.submit).click();
    await this.waitForNavigation();

    ConsoleColors.info(`TrocaFigurinhas - Definindo cookies para API`);
    const cookies = await this.cookies;
    const cookiesString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    axios.defaults.headers["Cookie"] = cookiesString;
    axios.defaults.headers["Content-Type"] = "application/x-www-form-urlencoded";
    ConsoleColors.success(`TrocaFigurinhas - Login concluído`);
  }

  private async findAlbumOption(selectSelector: string, album: string): Promise<string> {
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
    ConsoleColors.info(`Selecionando album na lista de colecionadores`);
    const selectors = SELECTORS.listaColecionadores.filtro;

    await this.page.locator(selectors.aba).click();

    ConsoleColors.info(`Buscando album no select`);
    const optionAlbum = await this.findAlbumOption(selectors.select, album);

    if (optionAlbum) await this.page.select(selectors.select, optionAlbum);
    else throw new Error(`Álbum "${album}" não encontrado no select da lista`);

    await this.wait(2000);

    ConsoleColors.info(`Confirmando busca por album`);
    await this.page.locator(selectors.submit).click();

    await this.waitForNavigation();
    ConsoleColors.success(`Album selecionado`);
  }

  private async htmlFromPage(): Promise<cheerio.CheerioAPI> {
    ConsoleColors.info(`Convertendo puppeteer para cheerio`);
    const pageHtml = await this.page.content();
    const html = cheerio.load(pageHtml);
    ConsoleColors.success(`Conversão concluída de puppeteer para cheerio`);
    return html;
  }

  private async obterDadosColecionadoresPagina(html: cheerio.CheerioAPI): Promise<Colecionador[]> {
    ConsoleColors.info(`Buscando colecionadores da página`);
    const tableId = SELECTORS.listaColecionadores.tabela.selector;
    const selectors = SELECTORS.listaColecionadores.tabela.colecionador;

    const divsPerfil = html(tableId).find(selectors.selector);

    const filterPresenca = (p: DomElement) => {
      const classes = html(p).attr("class") || "";
      return classes.includes("P") || classes.includes("PP");
    };

    const perfis: Colecionador[] = divsPerfil
      .map((_, p) => {
        const cardPerfil = html(p);

        const nick = cardPerfil.find(`${selectors.nick}, ${selectors.nick2}`).first().text().trim();
        const perfil = cardPerfil.find(selectors.perfil).attr("href") || "";
        const figurinhas = cardPerfil.find(selectors.figurinhas).attr("href") || "";
        const presenca = cardPerfil.find(selectors.presenca).toArray();

        const linkPerfil = perfil.replace("../", LINKS.base);
        const linkFigurinhas = figurinhas.replace("../", LINKS.base);

        const frequencia = presenca.filter(filterPresenca).length;
        const diasUltimoAcesso = frequencia > 0 ? presenca.findIndex(filterPresenca) : null;
        const worth =
          frequencia >= WORTH_MIN_FREQUENCIA &&
          diasUltimoAcesso !== null &&
          diasUltimoAcesso <= WORTH_MAX_ULTIMOACESSO;

        const colecionador: Colecionador = {
          nick,
          linkPerfil,
          linkFigurinhas,
          frequencia,
          diasUltimoAcesso,
          worth,
        };

        return colecionador;
      })
      .get();

    ConsoleColors.success(`Encontrados ${perfis.length} colecionadores na página`);
    return perfis;
  }

  private async getPageData(html: cheerio.CheerioAPI): Promise<PageData> {
    ConsoleColors.info(`Coletando dados do form da página`);
    const getInputValue = (selector: string): string => {
      return html(selector).attr("value") || "";
    };

    const selectors = SELECTORS.listaColecionadores.form;

    const viewState = getInputValue(selectors.viewState);
    const eventValidation = getInputValue(selectors.eventValidator);

    const data: PageData = { viewState, eventValidation };

    ConsoleColors.success(`Dados do form da página coletados`);
    return data;
  }

  private async paginasAcessiveisColecionadores(
    html: cheerio.CheerioAPI
  ): Promise<ColecionadorPaginacaoBloco> {
    ConsoleColors.info(`Buscando paginas acessiveis a partir do bloco`);
    const pageData = await this.getPageData(html);

    const selectors = SELECTORS.listaColecionadores.tabela;

    const table = html(selectors.selector);

    const pagesArgument = table
      .find(selectors.paginacao.proximasPages)
      .map(
        (_, element) =>
          html(element)
            .attr("href")
            ?.match(/Page\$\d+/)?.[0] || null
      )
      .get()
      .filter(Boolean);

    const divisor = PAGINACAO_COLECIONADORES_SIZE - 1;

    const bloco: ColecionadorPaginacaoBloco = {
      eventValidation: pageData.eventValidation,
      viewState: pageData.viewState,
      pageArguments: pagesArgument.slice(0, divisor),
      nextBlockArgument: pagesArgument.slice(divisor)[0] || null,
    };

    ConsoleColors.success(`Paginas acessiveis a partir do bloco encontradas`);
    return bloco;
  }

  private async paginaColecionadores(
    bloco: ColecionadorPaginacaoBloco,
    pageCode: string
  ): Promise<cheerio.CheerioAPI> {
    if (!pageCode) return null;

    ConsoleColors.info(`Buscando nova pagina de colecionadores por API`);
    const data: SiteRequest = {
      __EVENTTARGET: PAGINACAO_COLECIONADORES_EVENTTARGET,
      __EVENTARGUMENT: pageCode,
      __EVENTVALIDATION: bloco.eventValidation,
      __VIEWSTATE: bloco.viewState,
      __VIEWSTATEENCRYPTED: "",
    };
    const dataString = new URLSearchParams(data).toString();

    const htmlString: string = await axios
      .post(LINKS.localizarColecionadores, dataString)
      .then((res) => res.data);

    const html = cheerio.load(htmlString);

    ConsoleColors.success(`Nova pagina de colecionadores encontrada pela API`);
    return html;
  }

  private async encontrarColecionadoresPaginas(album: string): Promise<Colecionador[]> {
    ConsoleColors.info(`Buscando colecionadores online`);
    await this.goto(LINKS.localizarColecionadores);
    await this.selecionarAlbumPagina(album);

    this.colecionadores = [];
    const blocos: ColecionadorPaginacaoBloco[] = [];

    let proximaPagina = { html: await this.htmlFromPage(), label: "Page$1" };
    while (proximaPagina.html) {
      ConsoleColors.info(`Buscando pagina de bloco ${proximaPagina.label}`);
      const colecionadores = await this.obterDadosColecionadoresPagina(proximaPagina.html);

      this.colecionadores.push(...colecionadores);

      const bloco = await this.paginasAcessiveisColecionadores(proximaPagina.html);

      blocos.push(bloco);

      ConsoleColors.success(`Pagina de bloco finalizada ${proximaPagina.label}`);

      proximaPagina = {
        html: await this.paginaColecionadores(bloco, bloco.nextBlockArgument),
        label: bloco.nextBlockArgument,
      };
    }

    for (const bloco of blocos) {
      for (const pageArgument of bloco.pageArguments) {
        ConsoleColors.info(`Buscando pagina normal ${pageArgument}`);
        const pagina = await this.paginaColecionadores(bloco, pageArgument);

        const colecionadores = await this.obterDadosColecionadoresPagina(pagina);

        this.colecionadores.push(...colecionadores);
        ConsoleColors.success(`Pagina normal finalizada ${pageArgument}`);
      }
    }

    ConsoleColors.success(`Encontrados colecionadores online`);
    return this.colecionadores;
  }

  public async encontrarColecionadores(album: string): Promise<Colecionador[]> {
    ConsoleColors.info(`Buscando colecionadores do album ${album}`);
    if (this.buscarSalvosColecionadores(album)) {
      ConsoleColors.success(`Encontrados colecionadores do album ${album} já salvos`);
      return this.colecionadores;
    }

    await this.encontrarColecionadoresPaginas(album);

    ConsoleColors.info(`Salvando colecionadores online para local`);
    this.salvarColecionadores(this.colecionadores, album);

    ConsoleColors.success(`Encontrados colecionadores do album ${album}`);
    return this.colecionadores;
  }

  private async selecionarAlbumPerfil(album: string) {
    ConsoleColors.info(`Selecionando album no perfil do colecionador`);
    const selectors = SELECTORS.colecionador.albuns;

    await this.page.locator(selectors.trocarAlbum).click();

    const selecionar = async (selectSelector: string, submitSelector: string) => {
      const option = await this.findAlbumOption(selectSelector, album);
      if (option) {
        await this.page.select(selectSelector, option);
        await this.wait(2000);
        ConsoleColors.info(`Confirmando busca por album`);
        await this.page.locator(submitSelector).click();
        await this.waitForNavigation();
        ConsoleColors.success(`Album selecionado`);
        return true;
      }
      return false;
    };

    ConsoleColors.info(`Buscando album nos selects`);
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
    ConsoleColors.info(`Buscando cruzamento variado do colecionador`);
    const selectors = SELECTORS.colecionador.cruzamento;

    const lerFigurinhas = async (selector: string): Promise<string[]> => {
      const element = await this.page.waitForSelector(selector);
      const text = await element.evaluate((el) => el.textContent.trim());
      if (!REGEX_FIGURINHA.test(text)) return [];
      return text.split(", ");
    };

    const tem = await lerFigurinhas(selectors.figurinhas.tem);
    const falta = await lerFigurinhas(selectors.figurinhas.falta);

    const cruzamento: CruzamentoVariado = { falta, tem };

    ConsoleColors.success(`Cruzamento variado do encontrado`);
    return cruzamento;
  }

  private async workerEncontrarFigurinhas(
    colecionadores: Colecionador[],
    album: string
  ): Promise<void> {
    const site = await this.duplicar().catch(this.duplicar); // tenta ao menos duas vezes

    while (colecionadores.length) {
      const inicio = new Date();

      const colecionador = colecionadores.shift();

      if (colecionador.buscaFalhou) {
        ConsoleColors.warn(`Figurinhas - Repetindo: ${colecionador.nick}`);
      } else {
        ConsoleColors.info(`Figurinhas - Iniciando: ${colecionador.nick}`);
      }

      try {
        await site.goto(colecionador.linkFigurinhas);

        await site.selecionarAlbumPerfil(album);

        const cruzamento = await site.verificarCruzamentoVariado();

        colecionador.cruzamento = cruzamento;
        colecionador.buscaFalhou = undefined;

        ConsoleColors.success(
          `Figurinhas - Finalizado: ${colecionador.nick} - ${tempoCorrido(inicio)}`
        );
      } catch (err) {
        ConsoleColors.error(`Figurinhas - Erro: ${colecionador.nick} - ${tempoCorrido(inicio)}`);

        if (colecionador.buscaFalhou) continue;

        colecionador.buscaFalhou = true;
        colecionadores.push(colecionador);
      }
    }

    await site.finalizarPage();
  }

  public async encontrarFigurinhas(album: string): Promise<Colecionador[]> {
    if (!this.colecionadores) return;

    ConsoleColors.info(`Buscando figurinhas dos colecionadores`);
    const worth = this.colecionadores.filter((c) => c.worth);

    const buscas = Array.from({ length: TOTAL_WORKERS }).map(() =>
      this.workerEncontrarFigurinhas(worth, album)
    );

    await Promise.all(buscas);

    ConsoleColors.info(`Salvando figurinhas dos colecionadores`);
    this.salvarColecionadores(this.colecionadores, album);

    ConsoleColors.success(`Figurinhas dos colecionadores salvas`);
  }

  private salvarColecionadores(colecionadores: Colecionador[], album: string): void {
    const colecionadoresAlbum: ColecionadoresAlbumSalvos = fs.existsSync(COLECIONADORES_FILE)
      ? require(COLECIONADORES_FILE)
      : {};

    colecionadoresAlbum[album] = { date: Date.now(), colecionadores };

    const dir = path.dirname(COLECIONADORES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(COLECIONADORES_FILE, JSON.stringify(colecionadoresAlbum, null, 2));
  }

  private buscarSalvosColecionadores(album: string): Colecionador[] {
    if (!fs.existsSync(COLECIONADORES_FILE)) return null;

    const colecionadoresAlbum: ColecionadoresAlbumSalvos = require(COLECIONADORES_FILE);

    const salvos = colecionadoresAlbum[album];
    if (!salvos) return null;

    const dataSalvos = new Date(salvos.date);
    dataSalvos.setDate(dataSalvos.getDate() + DIAS_EXPIRACAO_COLECIONADORES_FILE);

    if (dataSalvos <= new Date()) return null;

    salvos.colecionadores.forEach((c) => (c.buscaFalhou = undefined));

    this.colecionadores = salvos.colecionadores;

    return this.colecionadores;
  }
}
