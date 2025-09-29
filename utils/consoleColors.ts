export default class ConsoleColors {
  public static readonly Reset = "\x1b[0m";
  public static readonly Bright = "\x1b[1m";
  public static readonly Dim = "\x1b[2m";
  public static readonly Underscore = "\x1b[4m";
  public static readonly Blink = "\x1b[5m";
  public static readonly Reverse = "\x1b[7m";
  public static readonly Hidden = "\x1b[8m";

  public static readonly FgBlack = "\x1b[30m";
  public static readonly FgRed = "\x1b[31m";
  public static readonly FgGreen = "\x1b[32m";
  public static readonly FgYellow = "\x1b[33m";
  public static readonly FgBlue = "\x1b[34m";
  public static readonly FgMagenta = "\x1b[35m";
  public static readonly FgCyan = "\x1b[36m";
  public static readonly FgWhite = "\x1b[37m";
  public static readonly FgGray = "\x1b[90m";

  public static readonly BgBlack = "\x1b[40m";
  public static readonly BgRed = "\x1b[41m";
  public static readonly BgGreen = "\x1b[42m";
  public static readonly BgYellow = "\x1b[43m";
  public static readonly BgBlue = "\x1b[44m";
  public static readonly BgMagenta = "\x1b[45m";
  public static readonly BgCyan = "\x1b[46m";
  public static readonly BgWhite = "\x1b[47m";
  public static readonly BgGray = "\x1b[100m";

  private static generateText(text: string, ...colors: string[]): string {
    const time = new Date().toLocaleTimeString();
    return [colors.join(""), `[${time}]\t ${text}`, this.Reset].join("");
  }

  public static log(...params: Parameters<typeof this.generateText>) {
    console.log(this.generateText(...params));
  }

  public static success(...params: Parameters<typeof this.generateText>) {
    console.info(this.generateText(params[0], ConsoleColors.FgGreen, ...params.slice(1)));
  }

  public static info(...params: Parameters<typeof this.generateText>) {
    console.info(this.generateText(params[0], ConsoleColors.FgCyan, ...params.slice(1)));
  }

  public static warn(...params: Parameters<typeof this.generateText>) {
    console.warn(this.generateText(params[0], ConsoleColors.FgYellow, ...params.slice(1)));
  }

  public static error(...params: Parameters<typeof this.generateText>) {
    console.error(this.generateText(params[0], ConsoleColors.FgRed, ...params.slice(1)));
  }
}
