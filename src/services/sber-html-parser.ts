import type { ImportAssetRow } from './import-parser';

interface PortfolioPosition {
  name: string;
  isin: string;
  currency: string;
  quantity: number;
  faceValue: number | undefined;
  marketPrice: number;
}

interface SecurityInfo {
  ticker: string;
  isin: string;
  type: string;
  emitter: string;
  securityCategory: string;
  issueInfo: string;
}

const SBER_TYPE_MAP: Record<string, string> = {
  'обыкновенная акция': 'Акции',
  'привилегированная акция': 'Акции',
  'государственная облигация': 'Облигации',
  'корпоративная облигация': 'Облигации',
  'облигация': 'Облигации',
  'муниципальная облигация': 'Облигации',
  'фонд закрытого типа': 'Фонды',
  'фонд открытого типа': 'Фонды',
  'биржевой паевой инвестиционный фонд': 'Фонды',
};

function parseSberNumber(s: string): number | undefined {
  if (!s || !s.trim()) return undefined;
  const cleaned = s.trim().replace(/\s/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

function findTableAfterText(doc: Document, searchText: string): HTMLTableElement | null {
  const paragraphs = doc.querySelectorAll('p');
  for (const p of paragraphs) {
    if (p.textContent?.includes(searchText)) {
      let sibling: Element | null = p.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === 'TABLE') return sibling as HTMLTableElement;
        sibling = sibling.nextElementSibling;
      }
    }
  }
  return null;
}

function parseSecuritiesReference(table: HTMLTableElement | null): Map<string, SecurityInfo> {
  const map = new Map<string, SecurityInfo>();
  if (!table) return map;

  const rows = table.querySelectorAll('tr');
  for (const row of rows) {
    if (row.classList.contains('table-header') || row.classList.contains('rn')) continue;

    const cells = row.querySelectorAll('td');
    if (cells.length < 5) continue;

    const name = cells[0].textContent?.trim() ?? '';
    const ticker = cells[1].textContent?.trim() ?? '';
    const isin = cells[2].textContent?.trim() ?? '';
    const emitter = cells[3].textContent?.trim() ?? '';
    const securityCategory = cells[4].textContent?.trim() ?? '';
    const issueInfo = cells[5]?.textContent?.trim() ?? '';

    if (!name || !ticker) continue;

    const type = SBER_TYPE_MAP[securityCategory.toLowerCase()] ?? 'Прочее';
    map.set(name, { ticker, isin, type, emitter, securityCategory, issueInfo });
  }

  return map;
}

function parsePortfolioTable(table: HTMLTableElement): PortfolioPosition[] {
  const positions: PortfolioPosition[] = [];
  const rows = table.querySelectorAll('tr');

  for (const row of rows) {
    if (
      row.classList.contains('table-header') ||
      row.classList.contains('rn') ||
      row.classList.contains('summary-row')
    ) continue;

    const cells = row.querySelectorAll('td');
    if (cells.length < 18) continue;
    if (cells[0].hasAttribute('colspan')) continue;

    const name = cells[0].textContent?.trim() ?? '';
    const isin = cells[1].textContent?.trim() ?? '';
    const currency = cells[2].textContent?.trim() ?? '';

    // End-of-period values: cols 8(qty), 9(nominal), 10(price)
    const quantity = parseSberNumber(cells[8]?.textContent ?? '');
    const faceValue = parseSberNumber(cells[9]?.textContent ?? '');
    const marketPrice = parseSberNumber(cells[10]?.textContent ?? '');

    if (!name || !quantity || marketPrice == null) continue;

    positions.push({ name, isin, currency, quantity, faceValue, marketPrice });
  }

  return positions;
}

export function parseSberHTML(html: string): ImportAssetRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const portfolioTable = findTableAfterText(doc, 'Портфель Ценных Бумаг');
  if (!portfolioTable) return [];

  const refTable = findTableAfterText(doc, 'Справочник Ценных Бумаг');
  const securityInfo = parseSecuritiesReference(refTable);

  const positions = parsePortfolioTable(portfolioTable);

  return positions.map((pos) => {
    const info = securityInfo.get(pos.name);
    const isBond = info?.type === 'Облигации';

    // Bonds: market price is in % of face value -> convert to rubles
    let currentPrice: number;
    if (isBond && pos.faceValue && pos.faceValue > 0) {
      currentPrice = Math.round(pos.faceValue * pos.marketPrice / 100 * 100) / 100;
    } else {
      currentPrice = pos.marketPrice;
    }

    return {
      ticker: info?.ticker,
      isin: info?.isin ?? pos.isin,
      name: pos.name,
      type: info?.type ?? 'Прочее',
      quantity: pos.quantity,
      currentPrice,
      faceValue: isBond ? pos.faceValue : undefined,
      currency: pos.currency || undefined,
      emitter: info?.emitter || undefined,
      securityCategory: info?.securityCategory || undefined,
      issueInfo: info?.issueInfo || undefined,
    };
  });
}
